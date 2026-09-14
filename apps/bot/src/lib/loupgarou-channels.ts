import { ChannelType, PermissionFlagsBits, type Guild, type OverwriteResolvable } from "discord.js";
import { isFakePlayer } from "./loupgarou-store.js";

export interface CreatedChannels {
  categoryId: string;
  villageVoiceId: string;
  wolvesTextId: string;
  actionsTextId: string;
}

export async function setupChannels(guild: Guild, playerIds: string[]): Promise<CreatedChannels | null> {
  const everyoneId = guild.roles.everyone.id;
  const botId = guild.members.me?.id;

  // Les faux joueurs (mode /loupgarou admintest) n'existent pas cote Discord - impossible
  // (et inutile) de leur creer une permission overwrite.
  const playerOverwrites: OverwriteResolvable[] = playerIds
    .filter((id) => !isFakePlayer(id))
    .map((id) => ({
      id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
    }));

  const category = await guild.channels
    .create({
      name: "🐺 Loup-Garou",
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
        ...(botId ? [{ id: botId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] : []),
        ...playerOverwrites,
      ],
    })
    .catch(() => null);
  if (!category) return null;

  // Un seul salon vocal pour toute la partie : personne n'est jamais deplace pendant la
  // nuit, sinon voir les loups disparaitre du salon commun reveille instantanement qui
  // ils sont. Leur vote reste prive via un salon TEXTE cache, sans equivalent vocal.
  // "village" (public) et "loups-garous" (prive) sont deliberement tres differents -
  // "loup-garou" et "loups-garous" cote a cote dans la liste des salons est illisible.
  const villageVoice = await guild.channels.create({ name: "🏘️ Village", type: ChannelType.GuildVoice, parent: category.id }).catch(() => null);
  const actionsText = await guild.channels.create({ name: "village", type: ChannelType.GuildText, parent: category.id }).catch(() => null);
  const wolvesText = await guild.channels
    .create({
      name: "loups-garous",
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [{ id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] }],
    })
    .catch(() => null);

  if (!villageVoice || !actionsText || !wolvesText) {
    await category.delete().catch(() => null);
    return null;
  }

  return {
    categoryId: category.id,
    villageVoiceId: villageVoice.id,
    wolvesTextId: wolvesText.id,
    actionsTextId: actionsText.id,
  };
}

// Autorise uniquement les loups a voir/ecrire dans leur salon texte prive (les autres
// joueurs restent explicitement exclus meme s'ils ont acces a la categorie).
export async function grantWolfAccess(guild: Guild, wolvesTextId: string, wolfUserIds: string[]): Promise<void> {
  const textChannel = await guild.channels.fetch(wolvesTextId).catch(() => null);

  for (const userId of wolfUserIds) {
    if (isFakePlayer(userId)) continue;
    if (textChannel?.type === ChannelType.GuildText) {
      await textChannel.permissionOverwrites.create(userId, { ViewChannel: true, SendMessages: true }).catch(() => null);
    }
  }
}

export async function moveMembersToChannel(guild: Guild, userIds: string[], channelId: string | null): Promise<void> {
  for (const userId of userIds) {
    if (isFakePlayer(userId)) continue;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member?.voice.channelId) continue;
    await member.voice.setChannel(channelId).catch(() => null);
  }
}

// Remet chaque joueur dans le salon vocal ou il etait avant la partie (ou le laisse tel
// quel si null - il n'etait dans aucun salon avant, il sera simplement deconnecte quand
// le salon de la partie sera supprime juste apres).
export async function restoreOriginalChannels(guild: Guild, originalChannels: Map<string, string | null>): Promise<void> {
  for (const [userId, channelId] of originalChannels) {
    if (isFakePlayer(userId) || !channelId) continue;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member?.voice.channelId) continue;
    await member.voice.setChannel(channelId).catch(() => null);
  }
}

export async function cleanupChannels(guild: Guild, channels: CreatedChannels): Promise<void> {
  const ids = [channels.wolvesTextId, channels.villageVoiceId, channels.actionsTextId, channels.categoryId];
  for (const id of ids) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    await channel?.delete().catch(() => null);
  }
}
