import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client, type Guild, type GuildMember } from "discord.js";
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
import {
  setupChannels,
  grantWolfAccess,
  moveMembersToChannel,
  restoreOriginalChannels,
  setPlayersMuted,
  getOrCreatePrivateChannel,
  cleanupPrivateChannels,
  cleanupChannels,
  type CreatedChannels,
} from "./loupgarou-channels.js";
import { joinNarratorChannel, narrate, leaveNarratorChannel, playSoundEffect, setAmbiance } from "./loupgarou-voice.js";
import { suspendRadioForGuild, resumeRadioForGuild, syncRadioPlayback } from "./radio.js";

const WOLF_VOTE_MS = 45_000;
const ROLE_ACTION_MS = 30_000;
const VILLAGE_VOTE_MS = 60_000;
const DISCUSSION_MS = 20_000;
const POST_GAME_DEBRIEF_MS = 5 * 60_000;

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

// Envoie un prompt d'action de nuit (role solo : Voyante, Sorciere, Cupidon, Chasseur)
// dans le salon texte prive du joueur plutot qu'en MP - contrairement au MP de reveal du
// role au tout debut de la partie, qui lui reste un vrai message prive (voir startGame).
// Si la creation du salon prive echoue pour une raison quelconque (permissions, souci
// Discord passager...), on retombe sur un vrai MP plutot que de laisser le prompt
// disparaitre silencieusement - un joueur ne doit jamais se retrouver sans son bouton.
async function sendPrivatePrompt(
  guild: Guild,
  game: LoupGarouGame,
  member: GuildMember,
  payload: { content: string; components?: ActionRowBuilder<ButtonBuilder>[] },
): Promise<void> {
  const result = game.categoryId
    ? await getOrCreatePrivateChannel(guild, game.categoryId, member.id, member.displayName, game.privateTextChannels)
    : null;

  if (!result) {
    console.error(`Repli sur MP pour ${member.id} (guilde ${guild.id}) - salon prive indisponible`);
    await member.send(payload).catch((error) => console.error(`Echec du MP de repli pour ${member.id} (guilde ${guild.id})`, error));
    return;
  }

  if (result.isNew) {
    await result.channel.send("🔒 Ce salon est privé - toi seul peux le voir. Tes actions de nuit s'y dérouleront.").catch(() => null);
  }
  await result.channel.send(payload).catch((error) => console.error(`Echec d'envoi dans le salon prive de ${member.id} (guilde ${guild.id})`, error));
}

function scheduleTimeout(game: LoupGarouGame, fn: () => void, ms: number): void {
  game.activeTimeouts.push(setTimeout(fn, ms));
}

// Petite pause entre deux temps forts pour laisser respirer la partie ("un truc chill",
// pas un enchainement instantane) - pas liee au jeu (pas de timeout de partie a nettoyer),
// juste un delai simple.
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

// Utilise dans les annonces de mort - reveler le role du joueur elimine est une regle
// classique du Loup-Garou, pas seulement son nom.
async function nameWithRole(guild: Guild, game: LoupGarouGame, userId: string): Promise<string> {
  const name = await displayName(guild, userId);
  const role = game.players.get(userId)?.role;
  return role ? `${name} (${ROLES[role].name})` : name;
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
    await channel?.send(`❌ Pas assez de joueurs (${game.lobbyPlayerIds.size}/${game.minPlayers} minimum). Partie annulée.`).catch(() => null);
    endGame(guild.id);
    return;
  }

  game.phase = "NIGHT_WOLF_VOTE"; // sortie immediate du lobby pour bloquer toute reentree pendant le setup
  await channel?.send(`✅ ${game.lobbyPlayerIds.size} joueurs prêts ! La partie commence, vérifiez vos messages privés...`).catch(() => null);
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
    await channel?.send("Impossible de créer les salons de la partie (vérifie que j'ai la permission Gérer les salons).").catch(() => null);
    endGame(game.guildId);
    return;
  }
  createdChannelsByGuild.set(game.guildId, channels);
  game.categoryId = channels.categoryId;
  game.villageVoiceId = channels.villageVoiceId;
  game.wolvesTextId = channels.wolvesTextId;
  game.channelId = channels.actionsTextId;

  // Retenu pour remettre chacun dans son salon d'origine a la fin de la partie (voir
  // cleanupGame), avant de tous les regrouper dans le salon vocal commun de la partie.
  for (const userId of playerIds) {
    if (isFakePlayer(userId)) continue;
    const member = await guild.members.fetch(userId).catch(() => null);
    game.originalVoiceChannels.set(userId, member?.voice.channelId ?? null);
  }

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
        `🐺 **Loup-Garou - ${guild.name}**\nTon rôle : **${role.name}** (camp : ${role.team === "LOUPS" ? "Loups-Garous" : "Village"})\n${role.description}`,
      )
      .catch(() => null);
  }

  await moveMembersToChannel(guild, playerIds, channels.villageVoiceId);
  // La radio (si elle jouait) partage la seule connexion vocale possible pour cette
  // guilde avec le narrateur - on la met en pause pour toute la duree de la partie, pas
  // seulement au demarrage, sinon son propre cycle de verification periodique (toutes
  // les 15s) la reconnecterait de force en pleine partie des qu'il la croit arretee.
  suspendRadioForGuild(guild.id);
  let voiceJoined = await joinNarratorChannel(client, guild.id, channels.villageVoiceId);
  if (!voiceJoined) {
    // La connexion vocale peut echouer ponctuellement (probleme reseau/Discord passager)
    // - un second essai suffit generalement. Si ca echoue encore, la partie continue en
    // texte seul plutot que de bloquer, mais les joueurs sont prevenus au lieu de se
    // demander pourquoi Tina reste muette (voir aussi narrate() dans loupgarou-voice.ts,
    // qui compense par une pause chaque ligne non parlee pour garder un rythme lisible).
    await pause(2000);
    voiceJoined = await joinNarratorChannel(client, guild.id, channels.villageVoiceId);
  }

  const actionsChannel = await getTextChannel(guild, channels.actionsTextId);
  if (!voiceJoined) {
    await actionsChannel
      ?.send("⚠️ Impossible de rejoindre le vocal pour la narration - la partie continue en texte uniquement dans ce salon.")
      .catch(() => null);
  }
  if (actionsChannel) {
    await narrate(
      guild.id,
      actionsChannel,
      `La partie commence avec ${playerIds.length} joueurs. Chacun a reçu son rôle par message privé. Que la partie commence !`,
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

  const villageChannel = await getTextChannel(guild, game.channelId);
  if (villageChannel) await narrate(guild.id, villageChannel, "💘 Cupidon se réveille et choisit en secret deux amoureux...");

  if (isFakePlayer(cupid.userId)) {
    const candidates = alivePlayers(game)
      .filter((p) => p.userId !== cupid.userId)
      .map((p) => p.userId)
      .sort(() => Math.random() - 0.5);
    if (candidates.length >= 2) {
      game.lovers = [candidates[0], candidates[1]];
      // Une fleche par amoureux designe.
      await playSoundEffect(guild.id, "cupidon");
      await playSoundEffect(guild.id, "cupidon");
    }
    await beginNight(client, guild, game);
    return;
  }

  game.phase = "CUPID_PICK_1";
  const member = await guild.members.fetch(cupid.userId).catch(() => null);
  const targets = alivePlayers(game)
    .filter((p) => p.userId !== cupid.userId)
    .map((p) => p.userId);
  const buttons = await playerButtons(guild, targets, "loupgarou:cupid1");
  if (member) {
    await sendPrivatePrompt(guild, game, member, {
      content: "💘 Tu es Cupidon. Choisis le **premier** amoureux :",
      components: chunkRows(buttons),
    });
  }

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
  await playSoundEffect(guild.id, "cupidon");

  const cupid = findByRole(game, "CUPIDON");
  if (!cupid) return;
  const member = await guild.members.fetch(cupid.userId).catch(() => null);
  const targets = alivePlayers(game)
    .filter((p) => p.userId !== cupid.userId && p.userId !== targetId)
    .map((p) => p.userId);
  const buttons = await playerButtons(guild, targets, "loupgarou:cupid2");
  if (member) {
    await sendPrivatePrompt(guild, game, member, {
      content: "💘 Choisis le **second** amoureux :",
      components: chunkRows(buttons),
    });
  }

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
  await playSoundEffect(guild.id, "cupidon");

  for (const userId of game.lovers) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) continue;
    const otherId = loverOf(game, userId);
    const otherName = otherId ? await displayName(guild, otherId) : "quelqu'un";
    await sendPrivatePrompt(guild, game, member, {
      content: `💘 Cupidon a fait de toi et **${otherName}** des amoureux. Si l'un de vous meurt, l'autre meurt de chagrin aussitôt.`,
    });
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

  // Personne ne devrait s'entendre parler pendant la nuit (le vote des loups passe par
  // des boutons, pas par la voix) - le sert-mute evite les discussions/reactions a voix
  // haute qui donneraient des indices. Demute au reveil, voir announceDeathsAndContinue.
  await setPlayersMuted(guild, [...game.players.keys()], true);

  // Pas de signal sonore pour l'entree en nuit (retire) - juste la musique d'ambiance.
  setAmbiance(guild.id, "night");
  const villageChannel = await getTextChannel(guild, game.channelId);
  if (villageChannel) await narrate(guild.id, villageChannel, `🌙 **Nuit ${game.nightNumber}** - Le village s'endort...`);
  await pause(2500);
  if (game.phase !== "NIGHT_WOLF_VOTE") return; // la partie a pu se terminer pendant la pause

  if (villageChannel) await narrate(guild.id, villageChannel, "🐺 Les Loups-Garous se réveillent et choisissent une victime...");

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
  if (!voyante) {
    await advanceFromVoyante(client, guild, game);
    return;
  }
  await playSoundEffect(guild.id, "voyante");
  const villageChannel = await getTextChannel(guild, game.channelId);
  if (villageChannel) await narrate(guild.id, villageChannel, "🔮 La Voyante se réveille et sonde un villageois...");

  if (isFakePlayer(voyante.userId)) {
    await advanceFromVoyante(client, guild, game);
    return;
  }

  game.phase = "NIGHT_VOYANTE";
  const member = await guild.members.fetch(voyante.userId).catch(() => null);
  const targets = alivePlayers(game)
    .filter((p) => p.userId !== voyante.userId)
    .map((p) => p.userId);
  const buttons = await playerButtons(guild, targets, "loupgarou:voyante");
  if (member) {
    await sendPrivatePrompt(guild, game, member, {
      content: "🔮 Choisis un joueur à sonder cette nuit :",
      components: chunkRows(buttons),
    });
  }

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
  if (!sorciere || !hasPotion) {
    await resolveNight(client, guild, game);
    return;
  }
  await playSoundEffect(guild.id, "sorciere");
  const villageChannel = await getTextChannel(guild, game.channelId);
  if (villageChannel) await narrate(guild.id, villageChannel, "🧪 La Sorcière se réveille...");

  if (isFakePlayer(sorciere.userId)) {
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
    ? `🧪 Les loups ont choisi de dévorer **${victimName}** cette nuit. Que fais-tu ?`
    : "🧪 Les loups n'ont mangé personne cette nuit. Veux-tu empoisonner quelqu'un ?";
  if (member) await sendPrivatePrompt(guild, game, member, { content: intro, components: chunkRows(buttons) });

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
  // Le village se reveille : tout le monde peut de nouveau se faire entendre.
  await setPlayersMuted(guild, [...game.players.keys()], false);

  // Meme logique que pour la nuit : l'ambiance change avant l'effet sonore. Le coq
  // annonce le reveil avant qu'on le decrive ; le couteau (s'il y a une victime) vient
  // ensuite comme un signal dramatique, juste avant la revelation parlee.
  setAmbiance(guild.id, "day");
  await playSoundEffect(guild.id, "dawn");
  const villageChannel = await getTextChannel(guild, game.channelId);

  if (dead.length === 0) {
    if (villageChannel) await narrate(guild.id, villageChannel, "☀️ Le village se réveille... et personne n'est mort cette nuit !");
  } else {
    await playSoundEffect(guild.id, "death");
    const names = await Promise.all(dead.map((id) => nameWithRole(guild, game, id)));
    if (villageChannel) {
      await narrate(guild.id, villageChannel, `☀️ Le village se réveille... ${names.join(", ")} ${names.length > 1 ? "sont morts" : "est mort"} cette nuit.`);
    }
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
  await playSoundEffect(guild.id, "chasseur");

  game.pendingChasseurCallback = onComplete;

  if (isFakePlayer(chasseurId)) {
    // Le faux Chasseur ne peut pas cliquer - il tire (ou non) aussitot au hasard.
    const targetId = Math.random() < 0.6 ? targets[Math.floor(Math.random() * targets.length)] : null;
    await resolveChasseurShot(client, guild, game, targetId);
    return;
  }

  const member = await guild.members.fetch(chasseurId).catch(() => null);
  const buttons = await playerButtons(guild, targets, "loupgarou:chasseur", ButtonStyle.Danger);
  if (member) {
    await sendPrivatePrompt(guild, game, member, {
      content: "🏹 Tu es mort, mais avant de partir tu peux tirer sur quelqu'un !",
      components: chunkRows(buttons),
    });
  }

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
      await playSoundEffect(guild.id, "death");
      const names = await Promise.all(dead.map((id) => nameWithRole(guild, game, id)));
      await narrate(guild.id, villageChannel, `🏹 Le Chasseur tire sur ${names.join(", ")} en tombant !`);
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
    // Un vrai temps de discussion avant le vote - sinon les boutons apparaissent
    // instantanement apres l'annonce des morts, sans laisser le temps d'en parler.
    await narrate(guild.id, villageChannel, "💬 Prenez le temps d'en discuter avant de voter...");
    await pause(DISCUSSION_MS);
    if (game.phase !== "DAY_VOTE") return; // la partie a pu se terminer pendant la pause (arret force, etc.)

    await narrate(guild.id, villageChannel, "🗳️ Le village doit maintenant voter pour éliminer un suspect.");
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
    if (villageChannel) await narrate(guild.id, villageChannel, "⚖️ Égalité des voix - personne n'est éliminé aujourd'hui.");
    await beginNight(client, guild, game);
    return;
  }

  const dead = applyDeaths(game, [eliminated]);
  await playSoundEffect(guild.id, "death");
  const names = await Promise.all(dead.map((id) => nameWithRole(guild, game, id)));
  if (villageChannel) await narrate(guild.id, villageChannel, `⚖️ Le village a voté. ${names.join(", ")} ${names.length > 1 ? "sont éliminés" : "est éliminé"}.`);

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
      winner === "LOUPS" ? "🐺 Les loups ont dévoré tout le village..." : "🏘️ Le village a éliminé tous les loups !",
    );
    await villageChannel.send({ embeds: [embed] }).catch(() => null);
  }

  for (const player of game.players.values()) {
    const won = ROLES[player.role].team === winner;
    await bumpStat(game.guildId, player.userId, won ? "wins" : "losses");
  }

  // Tina n'a plus rien a dire - elle quitte le vocal tout de suite (la radio peut
  // reprendre immediatement derriere, plutot que d'attendre le debrief). Tout le monde
  // est demute pour pouvoir debriefer, et les salons restent ouverts encore quelques
  // minutes avant le nettoyage complet (suppression + retour aux salons d'origine) -
  // /loupgarou stop declenche ce nettoyage immediatement si besoin (voir forceStopGame).
  await setPlayersMuted(guild, [...game.players.keys()], false);
  leaveNarratorChannel(guild.id);
  resumeRadioForGuild(guild.id);
  await syncRadioPlayback(client).catch((error) => console.error("Echec de la reprise de la radio apres la partie de loup-garou", error));

  if (villageChannel) {
    const minutes = Math.round(POST_GAME_DEBRIEF_MS / 60_000);
    await villageChannel
      .send(
        `💬 Les salons restent ouverts encore **${minutes} minutes** pour debriefer entre vous. Vous serez ensuite renvoyés dans vos salons d'origine.`,
      )
      .catch(() => null);
  }

  scheduleTimeout(game, () => void cleanupGame(client, guild, game), POST_GAME_DEBRIEF_MS);
}

async function cleanupGame(client: Client, guild: Guild, game: LoupGarouGame): Promise<void> {
  // Ne touche aux salons/voix que si la partie a vraiment demarre (des lors qu'un
  // lobby est annule avant le lancement, aucun joueur n'a ete deplace - inutile,
  // et potentiellement surprenant, de deconnecter qui que ce soit dans ce cas).
  const channels = createdChannelsByGuild.get(guild.id);
  if (channels) {
    // Filet de securite : si la partie s'arrete en pleine nuit (arret force, victoire
    // pendant NIGHT_*), personne ne doit rester sert-mute apres coup.
    await setPlayersMuted(guild, [...game.players.keys()], false);
    await restoreOriginalChannels(guild, game.originalVoiceChannels);
    createdChannelsByGuild.delete(guild.id);
    await cleanupPrivateChannels(guild, game.privateTextChannels);
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
