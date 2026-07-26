import { ChannelType, PermissionFlagsBits, type Guild, type OverwriteResolvable } from "discord.js";

export interface CreatedChannels {
  categoryId: string;
  villageVoiceId: string;
  wolvesVoiceId: string;
  wolvesTextId: string;
  actionsTextId: string;
}

export async function setupChannels(guild: Guild, playerIds: string[]): Promise<CreatedChannels | null> {
  const everyoneId = guild.roles.everyone.id;
  const botId = guild.members.me?.id;

  const playerOverwrites: OverwriteResolvable[] = playerIds.map((id) => ({
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

  const villageVoice = await guild.channels.create({ name: "🏘️ Village", type: ChannelType.GuildVoice, parent: category.id }).catch(() => null);
  const actionsText = await guild.channels.create({ name: "loup-garou", type: ChannelType.GuildText, parent: category.id }).catch(() => null);
  const wolvesVoice = await guild.channels
    .create({
      name: "🐺 Loups-Garous",
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [{ id: everyoneId, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }],
    })
    .catch(() => null);
  const wolvesText = await guild.channels
    .create({
      name: "loups-garous",
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [{ id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] }],
    })
    .catch(() => null);

  if (!villageVoice || !actionsText || !wolvesVoice || !wolvesText) {
    await category.delete().catch(() => null);
    return null;
  }

  return {
    categoryId: category.id,
    villageVoiceId: villageVoice.id,
    wolvesVoiceId: wolvesVoice.id,
    wolvesTextId: wolvesText.id,
    actionsTextId: actionsText.id,
  };
}

// Autorise uniquement les loups a voir/rejoindre leurs salons prives (les autres joueurs
// restent explicitement exclus meme s'ils ont acces a la categorie).
export async function grantWolfAccess(guild: Guild, wolvesVoiceId: string, wolvesTextId: string, wolfUserIds: string[]): Promise<void> {
  const voiceChannel = await guild.channels.fetch(wolvesVoiceId).catch(() => null);
  const textChannel = await guild.channels.fetch(wolvesTextId).catch(() => null);

  for (const userId of wolfUserIds) {
    if (voiceChannel?.isVoiceBased()) {
      await voiceChannel.permissionOverwrites.create(userId, { ViewChannel: true, Connect: true }).catch(() => null);
    }
    if (textChannel?.type === ChannelType.GuildText) {
      await textChannel.permissionOverwrites.create(userId, { ViewChannel: true, SendMessages: true }).catch(() => null);
    }
  }
}

export async function moveMembersToChannel(guild: Guild, userIds: string[], channelId: string | null): Promise<void> {
  for (const userId of userIds) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member?.voice.channelId) continue;
    await member.voice.setChannel(channelId).catch(() => null);
  }
}

export async function cleanupChannels(guild: Guild, channels: CreatedChannels): Promise<void> {
  const ids = [channels.wolvesVoiceId, channels.wolvesTextId, channels.villageVoiceId, channels.actionsTextId, channels.categoryId];
  for (const id of ids) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    await channel?.delete().catch(() => null);
  }
}
