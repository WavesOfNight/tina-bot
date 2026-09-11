import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client, type Guild } from "discord.js";
import { prisma } from "@tina/database";
import { ROLES, assignRoles, type RoleId } from "./loupgarou-roles.js";
import {
  type LoupGarouGame,
  type Winner,
  alivePlayers,
  aliveWolves,
  isAlive,
  isFakePlayer,
  fakePlayerLabel,
  getPlayer,
  findByRole,
  loverOf,
  applyDeaths,
  tallyVotes,
  checkWinner,
  clearGameTimeouts,
  endGame,
} from "./loupgarou-store.js";
import { setupChannels, grantWolfAccess, moveMembersToChannel, cleanupChannels, type CreatedChannels } from "./loupgarou-channels.js";
import { joinNarratorChannel, narrate, leaveNarratorChannel, playSoundEffect } from "./loupgarou-voice.js";
import { suspendRadioForGuild, resumeRadioForGuild, syncRadioPlayback } from "./radio.js";

const WOLF_VOTE_MS = 45_000;
const ROLE_ACTION_MS = 30_000;
const VILLAGE_VOTE_MS = 60_000;

const createdChannelsByGuild = new Map<string, CreatedChannels>();

function chunkRows(buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  return rows.slice(0, 5);
}

// Le guildId est toujours inclus dans le customId (pas seulement le userId) car ces
// boutons sont souvent envoyes en MP - la, interaction.guildId est null, donc c'est
// le seul moyen de retrouver la bonne partie depuis le gestionnaire de boutons.
async function playerButtons(guild: Guild, userIds: string[], prefix: string, style: ButtonStyle = ButtonStyle.Primary): Promise<ButtonBuilder[]> {
  const buttons: ButtonBuilder[] = [];
  for (const userId of userIds.slice(0, 24)) {
    const label = isFakePlayer(userId)
      ? fakePlayerLabel(userId)
      : ((await guild.members.fetch(userId).catch(() => null))?.displayName ?? "Joueur").slice(0, 80);
    buttons.push(new ButtonBuilder().setCustomId(`${prefix}:${guild.id}:${userId}`).setLabel(label).setStyle(style));
  }
  return buttons;
}

async function getTextChannel(guild: Guild, channelId: string | null) {
  if (!channelId) return null;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() && !channel.isDMBased() ? channel : null;
}

function scheduleTimeout(game: LoupGarouGame, fn: () => void, ms: number): void {
  game.activeTimeouts.push(setTimeout(fn, ms));
}

async function bumpStat(guildId: string, userId: string, field: "wins" | "losses"): Promise<void> {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "LOUPGAROU" } },
    create: { guildId, userId, game: "LOUPGAROU", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
}

async function displayName(guild: Guild, userId: string): Promise<string> {
  if (isFakePlayer(userId)) return fakePlayerLabel(userId);
  const member = await guild.members.fetch(userId).catch(() => null);
  return member?.displayName ?? "un joueur";
}

// ---------------------------------------------------------------------------
// Lancement
// ---------------------------------------------------------------------------

// Ferme le lobby (fin du timer ou "Demarrer maintenant") : annule si pas assez de
// joueurs, sinon lance la partie. Protege contre une double fermeture.
export async function closeLobby(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  if (game.phase !== "LOBBY") return;
  clearGameTimeouts(game);

  const channel = await getTextChannel(guild, game.channelId);
  if (game.lobbyPlayerIds.size < game.minPlayers) {
    await channel?.send(`❌ Pas assez de joueurs (${game.lobbyPlayerIds.size}/${game.minPlayers} minimum). Partie annulee.`).catch(() => null);
    endGame(guild.id);
    return;
  }

  game.phase = "NIGHT_WOLF_VOTE"; // sortie immediate du lobby pour bloquer toute reentree pendant le setup
  await channel?.send(`✅ ${game.lobbyPlayerIds.size} joueurs prets ! La partie commence, verifiez vos messages prives...`).catch(() => null);
  await startGame(client, guild, game);
}

export async function startGame(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  const playerIds = [...game.lobbyPlayerIds];
  const assignment = assignRoles(playerIds, game.roleOptions);
  for (const [userId, role] of assignment) {
    game.players.set(userId, { userId, role, alive: true });
  }

  const channels = await setupChannels(guild, playerIds);
  if (!channels) {
    const channel = await getTextChannel(guild, game.channelId);
    await channel?.send("Impossible de creer les salons de la partie (verifie que j'ai la permission Gerer les salons).").catch(() => null);
    endGame(game.guildId);
    return;
  }
  createdChannelsByGuild.set(game.guildId, channels);
  game.categoryId = channels.categoryId;
  game.villageVoiceId = channels.villageVoiceId;
  game.wolvesTextId = channels.wolvesTextId;
  game.channelId = channels.actionsTextId;

  const guildRecord = await prisma.guild.findUnique({ where: { id: guild.id } });
  game.returnVoiceChannelId = guildRecord?.radioEnabled ? (guildRecord.radioChannelId ?? null) : null;

  const wolfIds = alivePlayers(game)
    .filter((p) => p.role === "LOUP_GAROU")
    .map((p) => p.userId);
  await grantWolfAccess(guild, channels.wolvesTextId, wolfIds);

  for (const player of game.players.values()) {
    if (isFakePlayer(player.userId)) continue;
    const member = await guild.members.fetch(player.userId).catch(() => null);
    const role = ROLES[player.role];
    await member
      ?.send(
        `🐺 **Loup-Garou - ${guild.name}**\nTon role : **${role.name}** (camp : ${role.team === "LOUPS" ? "Loups-Garous" : "Village"})\n${role.description}`,
      )
      .catch(() => null);
  }

  await moveMembersToChannel(guild, playerIds, channels.villageVoiceId);
  // La radio (si elle jouait) partage la seule connexion vocale possible pour cette
  // guilde avec le narrateur - on la met en pause pour toute la duree de la partie, pas
  // seulement au demarrage, sinon son propre cycle de verification periodique (toutes
  // les 15s) la reconnecterait de force en pleine partie des qu'il la croit arretee.
  suspendRadioForGuild(guild.id);
  await joinNarratorChannel(client, guild.id, channels.villageVoiceId);

  const actionsChannel = await getTextChannel(guild, channels.actionsTextId);
  if (actionsChannel) {
    await narrate(
      guild.id,
      actionsChannel,
      `La partie commence avec ${playerIds.length} joueurs. Chacun a recu son role par message prive. Que la partie commence !`,
    );
  }

  await startCupidStep(client, guild, game);
}

// ---------------------------------------------------------------------------
// Cupidon (nuit 0)
// ---------------------------------------------------------------------------

async function startCupidStep(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  const cupid = findByRole(game, "CUPIDON");
  if (!cupid) {
    await beginNight(client, guild, game);
    return;
  }

  if (isFakePlayer(cupid.userId)) {
    const candidates = alivePlayers(game)
      .filter((p) => p.userId !== cupid.userId)
      .map((p) => p.userId)
      .sort(() => Math.random() - 0.5);
    if (candidates.length >= 2) game.lovers = [candidates[0], candidates[1]];
    await beginNight(client, guild, game);
    return;
  }

  game.phase = "CUPID_PICK_1";
  const member = await guild.members.fetch(cupid.userId).catch(() => null);
  const targets = alivePlayers(game)
    .filter((p) => p.userId !== cupid.userId)
    .map((p) => p.userId);
  const buttons = await playerButtons(guild, targets, "loupgarou:cupid1");
  await member?.send({ content: "💘 Tu es Cupidon. Choisis le **premier** amoureux :", components: chunkRows(buttons) }).catch(() => null);

  scheduleTimeout(
    game,
    () => {
      if (game.phase !== "CUPID_PICK_1") return;
      void beginNight(client, guild, game);
    },
    ROLE_ACTION_MS,
  );
}

export async function handleCupidPick1(client: Client, guild: Guild, game: LoupGarouGame, targetId: string): Promise<void> {
  if (game.phase !== "CUPID_PICK_1") return;
  game.cupidFirstPick = targetId;
  game.phase = "CUPID_PICK_2";

  const cupid = findByRole(game, "CUPIDON");
  if (!cupid) return;
  const member = await guild.members.fetch(cupid.userId).catch(() => null);
  const targets = alivePlayers(game)
    .filter((p) => p.userId !== cupid.userId && p.userId !== targetId)
    .map((p) => p.userId);
  const buttons = await playerButtons(guild, targets, "loupgarou:cupid2");
  await member?.send({ content: "💘 Choisis le **second** amoureux :", components: chunkRows(buttons) }).catch(() => null);

  scheduleTimeout(
    game,
    () => {
      if (game.phase !== "CUPID_PICK_2") return;
      void beginNight(client, guild, game);
    },
    ROLE_ACTION_MS,
  );
}

export async function handleCupidPick2(client: Client, guild: Guild, game: LoupGarouGame, targetId: string): Promise<void> {
  if (game.phase !== "CUPID_PICK_2" || !game.cupidFirstPick) return;
  game.lovers = [game.cupidFirstPick, targetId];
  game.cupidFirstPick = null;

  for (const userId of game.lovers) {
    const member = await guild.members.fetch(userId).catch(() => null);
    const otherId = loverOf(game, userId);
    const otherName = otherId ? await displayName(guild, otherId) : "quelqu'un";
    await member
      ?.send(`💘 Cupidon a fait de toi et **${otherName}** des amoureux. Si l'un de vous meurt, l'autre meurt de chagrin aussitot.`)
      .catch(() => null);
  }

  await beginNight(client, guild, game);
}

// ---------------------------------------------------------------------------
// Nuit - vote des loups
// ---------------------------------------------------------------------------

async function beginNight(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  game.nightNumber += 1;
  game.wolfVotes.clear();
  game.pendingNightVictim = null;
  game.nightDeaths = [];
  game.phase = "NIGHT_WOLF_VOTE";

  const villageChannel = await getTextChannel(guild, game.channelId);
  if (villageChannel) await narrate(guild.id, villageChannel, `🌙 **Nuit ${game.nightNumber}** - Le village s'endort...`);
  await playSoundEffect(guild.id, "night");

  // Tout le monde reste dans le meme salon vocal toute la partie, y compris les loups :
  // les deplacer vers un salon prive reviendrait a reveler publiquement qui ils sont des
  // qu'ils disparaissent du salon commun. Leur vote reste prive via le salon texte cache.
  const wolves = aliveWolves(game).map((p) => p.userId);

  const targets = alivePlayers(game)
    .filter((p) => p.role !== "LOUP_GAROU")
    .map((p) => p.userId);

  if (wolves.length === 0 || targets.length === 0) {
    await resolveWolfVote(client, guild, game);
    return;
  }

  // Les faux loups (mode admintest) ne peuvent pas cliquer un bouton - ils votent
  // aussitot pour une cible aleatoire.
  for (const wolfId of wolves) {
    if (isFakePlayer(wolfId)) game.wolfVotes.set(wolfId, targets[Math.floor(Math.random() * targets.length)]);
  }
  if (game.wolfVotes.size >= wolves.length) {
    await resolveWolfVote(client, guild, game);
    return;
  }

  const wolvesChannel = await getTextChannel(guild, game.wolvesTextId);
  if (wolvesChannel) {
    await narrate(guild.id, wolvesChannel, "🐺 Loups-garous, choisissez votre victime :");
    const buttons = await playerButtons(guild, targets, "loupgarou:wolfvote", ButtonStyle.Danger);
    await wolvesChannel.send({ components: chunkRows(buttons) }).catch(() => null);
  }

  scheduleTimeout(game, () => void resolveWolfVote(client, guild, game), WOLF_VOTE_MS);
}

export async function handleWolfVote(client: Client, guild: Guild, game: LoupGarouGame, voterId: string, targetId: string): Promise<boolean> {
  if (game.phase !== "NIGHT_WOLF_VOTE") return false;
  const voter = getPlayer(game, voterId);
  if (!voter || !voter.alive || voter.role !== "LOUP_GAROU") return false;

  game.wolfVotes.set(voterId, targetId);
  if (game.wolfVotes.size >= aliveWolves(game).length) {
    await resolveWolfVote(client, guild, game);
  }
  return true;
}

async function resolveWolfVote(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  if (game.phase !== "NIGHT_WOLF_VOTE") return;
  game.phase = "NIGHT_VOYANTE";

  const topChoices = tallyVotes(game.wolfVotes);
  game.pendingNightVictim = topChoices.length > 0 ? topChoices[Math.floor(Math.random() * topChoices.length)] : null;

  await runVoyanteStep(client, guild, game);
}

// ---------------------------------------------------------------------------
// Nuit - Voyante
// ---------------------------------------------------------------------------

async function runVoyanteStep(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  const voyante = findByRole(game, "VOYANTE");
  if (!voyante || isFakePlayer(voyante.userId)) {
    await advanceFromVoyante(client, guild, game);
    return;
  }

  game.phase = "NIGHT_VOYANTE";
  const member = await guild.members.fetch(voyante.userId).catch(() => null);
  const targets = alivePlayers(game)
    .filter((p) => p.userId !== voyante.userId)
    .map((p) => p.userId);
  const buttons = await playerButtons(guild, targets, "loupgarou:voyante");
  await member?.send({ content: "🔮 Choisis un joueur a sonder cette nuit :", components: chunkRows(buttons) }).catch(() => null);

  scheduleTimeout(game, () => void advanceFromVoyante(client, guild, game), ROLE_ACTION_MS);
}

export async function handleVoyantePick(guild: Guild, game: LoupGarouGame, voyanteId: string, targetId: string): Promise<RoleId | null> {
  if (game.phase !== "NIGHT_VOYANTE") return null;
  const voyante = getPlayer(game, voyanteId);
  if (!voyante || !voyante.alive || voyante.role !== "VOYANTE") return null;
  return getPlayer(game, targetId)?.role ?? null;
}

// Doit etre appele juste apres handleVoyantePick a resolu la reponse (ou par le timeout).
export async function advanceFromVoyante(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  if (game.phase !== "NIGHT_VOYANTE") return;
  game.phase = "NIGHT_SORCIERE";
  await runSorciereStep(client, guild, game);
}

// ---------------------------------------------------------------------------
// Nuit - Sorciere
// ---------------------------------------------------------------------------

async function runSorciereStep(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  const sorciere = findByRole(game, "SORCIERE");
  const hasPotion = sorciere ? !game.witch.lifePotionUsed || !game.witch.deathPotionUsed : false;
  if (!sorciere || !hasPotion || isFakePlayer(sorciere.userId)) {
    await resolveNight(client, guild, game);
    return;
  }

  const member = await guild.members.fetch(sorciere.userId).catch(() => null);
  const victimName = game.pendingNightVictim ? await displayName(guild, game.pendingNightVictim) : null;

  const buttons: ButtonBuilder[] = [];
  if (!game.witch.lifePotionUsed && game.pendingNightVictim) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`loupgarou:witchsave:${guild.id}:${game.pendingNightVictim}`)
        .setLabel(`Sauver ${victimName}`)
        .setStyle(ButtonStyle.Success),
    );
  }
  if (!game.witch.deathPotionUsed) {
    const targets = alivePlayers(game)
      .filter((p) => p.userId !== sorciere.userId)
      .map((p) => p.userId);
    const poisonButtons = await playerButtons(guild, targets, "loupgarou:witchpoison", ButtonStyle.Danger);
    buttons.push(...poisonButtons.slice(0, Math.max(0, 23 - buttons.length)));
  }
  buttons.push(new ButtonBuilder().setCustomId(`loupgarou:witchskip:${guild.id}:_`).setLabel("Ne rien faire").setStyle(ButtonStyle.Secondary));

  const intro = game.pendingNightVictim
    ? `🧪 Les loups ont choisi de devorer **${victimName}** cette nuit. Que fais-tu ?`
    : "🧪 Les loups n'ont mange personne cette nuit. Veux-tu empoisonner quelqu'un ?";
  await member?.send({ content: intro, components: chunkRows(buttons) }).catch(() => null);

  scheduleTimeout(game, () => void resolveNight(client, guild, game), ROLE_ACTION_MS);
}

export async function handleWitchAction(
  client: Client,
  guild: Guild,
  game: LoupGarouGame,
  action: "save" | "poison" | "skip",
  targetId: string | null,
): Promise<void> {
  if (game.phase !== "NIGHT_SORCIERE") return;
  if (action === "save" && !game.witch.lifePotionUsed) {
    game.witch.lifePotionUsed = true;
    game.pendingNightVictim = null;
  } else if (action === "poison" && targetId && !game.witch.deathPotionUsed) {
    game.witch.deathPotionUsed = true;
    game.nightDeaths.push(targetId);
  }
  await resolveNight(client, guild, game);
}

// ---------------------------------------------------------------------------
// Nuit - resolution
// ---------------------------------------------------------------------------

async function resolveNight(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  if (game.phase !== "NIGHT_SORCIERE") return;
  game.phase = "NIGHT_RESULTS";

  const targets = [...game.nightDeaths];
  if (game.pendingNightVictim) targets.push(game.pendingNightVictim);
  const dead = applyDeaths(game, targets);

  await announceDeathsAndContinue(client, guild, game, dead, () => runDayPhase(client, guild, game));
}

async function announceDeathsAndContinue(
  client: Client,
  guild: Guild,
  game: LoupGarouGame,
  dead: string[],
  onComplete: () => Promise<void> | void,
): Promise<void> {
  const villageChannel = await getTextChannel(guild, game.channelId);

  if (dead.length === 0) {
    if (villageChannel) await narrate(guild.id, villageChannel, "☀️ Le village se reveille... et personne n'est mort cette nuit !");
    await playSoundEffect(guild.id, "dawn");
  } else {
    const names = await Promise.all(dead.map((id) => displayName(guild, id)));
    if (villageChannel) {
      await narrate(guild.id, villageChannel, `☀️ Le village se reveille... ${names.join(", ")} ${names.length > 1 ? "sont morts" : "est mort"} cette nuit.`);
    }
    await playSoundEffect(guild.id, "death");
    await playSoundEffect(guild.id, "dawn");
  }

  const winner = checkWinner(game);
  if (winner) {
    await endGameWithWinner(client, guild, game, winner);
    return;
  }

  const chasseur = dead.find((id) => game.players.get(id)?.role === "CHASSEUR");
  if (chasseur) {
    await promptChasseurRevenge(client, guild, game, chasseur, onComplete);
    return;
  }

  await onComplete();
}

// ---------------------------------------------------------------------------
// Chasseur (declenche depuis la nuit ou le vote du village)
// ---------------------------------------------------------------------------

async function promptChasseurRevenge(
  client: Client,
  guild: Guild,
  game: LoupGarouGame,
  chasseurId: string,
  onComplete: () => Promise<void> | void,
): Promise<void> {
  const targets = alivePlayers(game).map((p) => p.userId);
  if (targets.length === 0) {
    await onComplete();
    return;
  }

  game.pendingChasseurCallback = onComplete;

  if (isFakePlayer(chasseurId)) {
    // Le faux Chasseur ne peut pas cliquer - il tire (ou non) aussitot au hasard.
    const targetId = Math.random() < 0.6 ? targets[Math.floor(Math.random() * targets.length)] : null;
    await resolveChasseurShot(client, guild, game, targetId);
    return;
  }

  const member = await guild.members.fetch(chasseurId).catch(() => null);
  const buttons = await playerButtons(guild, targets, "loupgarou:chasseur", ButtonStyle.Danger);
  await member?.send({ content: "🏹 Tu es mort, mais avant de partir tu peux tirer sur quelqu'un !", components: chunkRows(buttons) }).catch(() => null);

  scheduleTimeout(game, () => void resolveChasseurShot(client, guild, game, null), ROLE_ACTION_MS);
}

export async function handleChasseurShot(client: Client, guild: Guild, game: LoupGarouGame, targetId: string | null): Promise<void> {
  await resolveChasseurShot(client, guild, game, targetId);
}

async function resolveChasseurShot(client: Client, guild: Guild, game: LoupGarouGame, targetId: string | null): Promise<void> {
  const callback = game.pendingChasseurCallback;
  if (!callback) return;
  game.pendingChasseurCallback = null;

  if (targetId) {
    const dead = applyDeaths(game, [targetId]);
    const villageChannel = await getTextChannel(guild, game.channelId);
    if (dead.length > 0 && villageChannel) {
      const names = await Promise.all(dead.map((id) => displayName(guild, id)));
      await narrate(guild.id, villageChannel, `🏹 Le Chasseur tire sur ${names.join(", ")} en tombant !`);
      await playSoundEffect(guild.id, "death");
    }

    const winner = checkWinner(game);
    if (winner) {
      await endGameWithWinner(client, guild, game, winner);
      return;
    }

    const secondChasseur = dead.find((id) => game.players.get(id)?.role === "CHASSEUR");
    if (secondChasseur) {
      await promptChasseurRevenge(client, guild, game, secondChasseur, callback);
      return;
    }
  }

  await callback();
}

// ---------------------------------------------------------------------------
// Jour - vote du village
// ---------------------------------------------------------------------------

async function runDayPhase(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  game.villageVotes.clear();
  game.phase = "DAY_VOTE";

  const targets = alivePlayers(game).map((p) => p.userId);

  // Les faux villageois (mode admintest) votent aussitot pour une cible aleatoire.
  for (const userId of targets) {
    if (!isFakePlayer(userId)) continue;
    const choices = targets.filter((id) => id !== userId);
    if (choices.length > 0) game.villageVotes.set(userId, choices[Math.floor(Math.random() * choices.length)]);
  }
  if (game.villageVotes.size >= targets.length) {
    await resolveVillageVote(client, guild, game);
    return;
  }

  const villageChannel = await getTextChannel(guild, game.channelId);
  if (villageChannel) {
    await narrate(guild.id, villageChannel, "🗳️ Le village doit maintenant voter pour eliminer un suspect.");
    const buttons = await playerButtons(guild, targets, "loupgarou:villagevote", ButtonStyle.Danger);
    await villageChannel.send({ components: chunkRows(buttons) }).catch(() => null);
  }

  scheduleTimeout(game, () => void resolveVillageVote(client, guild, game), VILLAGE_VOTE_MS);
}

export async function handleVillageVote(client: Client, guild: Guild, game: LoupGarouGame, voterId: string, targetId: string): Promise<boolean> {
  if (game.phase !== "DAY_VOTE") return false;
  if (!isAlive(game, voterId)) return false;

  game.villageVotes.set(voterId, targetId);
  if (game.villageVotes.size >= alivePlayers(game).length) {
    await resolveVillageVote(client, guild, game);
  }
  return true;
}

async function resolveVillageVote(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  if (game.phase !== "DAY_VOTE") return;
  game.phase = "DAY_RESULTS";

  const topChoices = tallyVotes(game.villageVotes);
  const eliminated = topChoices.length === 1 ? topChoices[0] : null;

  const villageChannel = await getTextChannel(guild, game.channelId);
  if (!eliminated) {
    if (villageChannel) await narrate(guild.id, villageChannel, "⚖️ Egalite des voix - personne n'est elimine aujourd'hui.");
    await beginNight(client, guild, game);
    return;
  }

  const dead = applyDeaths(game, [eliminated]);
  const names = await Promise.all(dead.map((id) => displayName(guild, id)));
  if (villageChannel) await narrate(guild.id, villageChannel, `⚖️ Le village a vote. ${names.join(", ")} ${names.length > 1 ? "sont elimines" : "est elimine"}.`);
  await playSoundEffect(guild.id, "death");

  const winner = checkWinner(game);
  if (winner) {
    await endGameWithWinner(client, guild, game, winner);
    return;
  }

  const chasseur = dead.find((id) => game.players.get(id)?.role === "CHASSEUR");
  if (chasseur) {
    await promptChasseurRevenge(client, guild, game, chasseur, () => beginNight(client, guild, game));
    return;
  }

  await beginNight(client, guild, game);
}

// ---------------------------------------------------------------------------
// Fin de partie
// ---------------------------------------------------------------------------

async function endGameWithWinner(client: Client, guild: Guild, game: LoupGarouGame, winner: Winner): Promise<void> {
  game.phase = "ENDED";
  clearGameTimeouts(game);

  const villageChannel = await getTextChannel(guild, game.channelId);
  const summaryLines: string[] = [];
  for (const player of game.players.values()) {
    const name = await displayName(guild, player.userId);
    summaryLines.push(`${player.alive ? "🟢" : "💀"} ${name} - ${ROLES[player.role].name}`);
  }

  const embed = new EmbedBuilder()
    .setColor(winner === "LOUPS" ? 0x8b0000 : 0x2e8b57)
    .setTitle(winner === "LOUPS" ? "🐺 Les Loups-Garous gagnent !" : "🏘️ Le Village gagne !")
    .setDescription(summaryLines.join("\n"));

  if (villageChannel) {
    await narrate(
      guild.id,
      villageChannel,
      winner === "LOUPS" ? "🐺 Les loups ont devore tout le village..." : "🏘️ Le village a elimine tous les loups !",
    );
    await villageChannel.send({ embeds: [embed] }).catch(() => null);
  }

  for (const player of game.players.values()) {
    const won = ROLES[player.role].team === winner;
    await bumpStat(game.guildId, player.userId, won ? "wins" : "losses");
  }

  await cleanupGame(client, guild, game);
}

async function cleanupGame(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  // Ne touche aux salons/voix que si la partie a vraiment demarre (des lors qu'un
  // lobby est annule avant le lancement, aucun joueur n'a ete deplace - inutile,
  // et potentiellement surprenant, de deconnecter qui que ce soit dans ce cas).
  const channels = createdChannelsByGuild.get(guild.id);
  if (channels) {
    if (game.returnVoiceChannelId) {
      const playerIds = [...game.players.keys(), ...game.lobbyPlayerIds];
      await moveMembersToChannel(guild, playerIds, game.returnVoiceChannelId);
    }
    createdChannelsByGuild.delete(guild.id);
    await cleanupChannels(guild, channels);

    leaveNarratorChannel(guild.id);
    // Leve la pause et relance la verification tout de suite (plutot que d'attendre
    // jusqu'a 15s le prochain cycle naturel) pour que la radio reprenne sans delai si
    // elle est configuree sur cette guilde.
    resumeRadioForGuild(guild.id);
    await syncRadioPlayback(client).catch((error) => console.error("Echec de la reprise de la radio apres la partie de loup-garou", error));
  } else {
    leaveNarratorChannel(guild.id);
  }

  endGame(guild.id);
}

// Arret force d'une partie (host/admin) - fonctionne aussi bien pour un lobby qu'une
// partie en cours.
export async function forceStopGame(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  clearGameTimeouts(game);
  await cleanupGame(client, guild, game);
}
