import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type GuildMember,
  type UserSelectMenuInteraction,
  type VoiceBasedChannel,
  type VoiceChannel,
} from "discord.js";
import { prisma, findAutoModMatch } from "@tina/database";
import { logCase, applyWarnEscalation } from "./moderation.js";

const MAX_CHANNEL_NAME_LENGTH = 100;

// Les salons vocaux crees sont publics et restent affiches en permanence dans la liste
// des salons - meme si la moderation automatique du chat est desactivee sur la guilde,
// on bloque toujours au minimum les propos les plus graves (niveau LOW) dans leur nom.
export async function findChannelNameViolation(guildId: string, name: string): Promise<string | null> {
  const guildData = await prisma.guild.findUnique({ where: { id: guildId } });
  const level = guildData?.autoModLevel && guildData.autoModLevel !== "OFF" ? guildData.autoModLevel : "LOW";
  return findAutoModMatch(level, name);
}

function buildDefaultChannelName(template: string, displayName: string): string {
  const name = template.replace("{user}", displayName).trim();
  return (name || `Salon de ${displayName}`).slice(0, MAX_CHANNEL_NAME_LENGTH);
}

// Cree le salon vocal personnel d'un membre qui vient de rejoindre le salon "hub", avec
// les memes visibilite/parent que celui-ci, et donne uniquement au proprietaire le droit
// de le gerer (renommer, limiter, deplacer des membres).
export async function createTempVoiceChannel(guild: Guild, member: GuildMember, hub: VoiceBasedChannel): Promise<VoiceChannel | null> {
  const guildData = await prisma.guild.upsert({ where: { id: guild.id }, create: { id: guild.id }, update: {} });

  let name = buildDefaultChannelName(guildData.hubChannelNameTemplate, member.displayName);
  // Le nom par defaut derive du pseudo du membre (qu'il ne choisit pas ici) - s'il
  // contient un mot banni, on retombe silencieusement sur un nom generique plutot que de
  // le sanctionner pour un pseudo qui n'est pas le nom de salon qu'il a lui-meme choisi.
  if (await findChannelNameViolation(guild.id, name)) name = "🔊 Salon vocal";

  const channel = await guild.channels
    .create({
      name,
      type: ChannelType.GuildVoice,
      parent: hub.parentId,
      permissionOverwrites: [
        { id: member.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
      ],
    })
    .catch(() => null);
  if (!channel) return null;

  await prisma.tempVoiceChannel.create({ data: { guildId: guild.id, channelId: channel.id, ownerId: member.id } });
  return channel;
}

// Supprime un salon personnel des qu'il se retrouve vide (personne ne le "possede" plus
// activement) - ne touche jamais un salon qui n'est pas suivi (le hub lui-meme, ou tout
// autre salon vocal normal de la guilde).
export async function deleteIfEmpty(channel: VoiceBasedChannel): Promise<void> {
  const record = await prisma.tempVoiceChannel.findUnique({ where: { channelId: channel.id } });
  if (!record || channel.members.size > 0) return;
  await prisma.tempVoiceChannel.delete({ where: { channelId: channel.id } }).catch(() => null);
  await channel.delete().catch(() => null);
}

// Avertit le proprietaire (comme n'importe quelle autre violation d'automod, avec
// escalade) et supprime aussitot son salon des qu'il tente de lui donner un nom banni.
export async function warnAndDeleteForBadName(guild: Guild, channel: VoiceBasedChannel, ownerId: string, matchedWord: string): Promise<void> {
  await prisma.tempVoiceChannel.delete({ where: { channelId: channel.id } }).catch(() => null);

  await logCase({
    guild,
    userId: ownerId,
    moderatorId: guild.client.user.id,
    type: "AUTOMOD",
    reason: `nom de salon vocal filtre : "${matchedWord}"`,
  });
  await applyWarnEscalation(guild, ownerId);

  const member = await guild.members.fetch(ownerId).catch(() => null);
  await member
    ?.send(
      `⚠️ Ton salon vocal personnalisé sur **${guild.name}** a été supprimé car son nom contenait un terme interdit (${matchedWord}). Tu peux en recréer un avec un nom correct.`,
    )
    .catch(() => null);

  await channel.delete().catch(() => null);
}

// Gestionnaire du menu "restreindre l'acces" propose apres /creer-vocal (voir
// creer-vocal.ts) - selection vide = salon remis public, sinon seuls les membres
// selectionnes (+ le proprietaire) peuvent le voir/rejoindre.
export async function applyVoiceChannelAccess(interaction: UserSelectMenuInteraction, channelId: string): Promise<void> {
  if (!interaction.guild) return;
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isVoiceBased()) {
    await interaction.update({ content: "Ce salon n'existe plus.", embeds: [], components: [] }).catch(() => null);
    return;
  }

  const everyoneId = interaction.guild.roles.everyone.id;
  const selected = interaction.values;

  if (selected.length === 0) {
    await channel.permissionOverwrites.edit(everyoneId, { ViewChannel: null, Connect: null }).catch(() => null);
    await interaction.update({ content: `🔊 **${channel.name}** est public - tout le monde peut le rejoindre.`, embeds: [], components: [] }).catch(() => null);
    return;
  }

  await channel.permissionOverwrites.edit(everyoneId, { ViewChannel: false, Connect: false }).catch(() => null);
  const botId = interaction.guild.members.me?.id;
  if (botId) await channel.permissionOverwrites.edit(botId, { ViewChannel: true, Connect: true }).catch(() => null);
  for (const userId of selected) {
    await channel.permissionOverwrites.edit(userId, { ViewChannel: true, Connect: true }).catch(() => null);
  }

  await interaction
    .update({
      content: `🔒 **${channel.name}** est maintenant privé - accès limité à : ${selected.map((id) => `<@${id}>`).join(", ")}`,
      embeds: [],
      components: [],
    })
    .catch(() => null);
}

// Filet de securite periodique (voir ready.ts) : supprime les salons personnels devenus
// vides ou orphelins (supprimes manuellement) - couvre le cas ou le bot etait hors ligne
// au moment ou tout le monde est parti.
export async function cleanupEmptyTempChannels(client: Client): Promise<void> {
  const records = await prisma.tempVoiceChannel.findMany();
  for (const record of records) {
    const guild = await client.guilds.fetch(record.guildId).catch(() => null);
    const channel = guild ? await guild.channels.fetch(record.channelId).catch(() => null) : null;
    if (!channel?.isVoiceBased() || channel.members.size === 0) {
      await prisma.tempVoiceChannel.delete({ where: { id: record.id } }).catch(() => null);
      await channel?.delete().catch(() => null);
    }
  }
}
