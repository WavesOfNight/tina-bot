import type { Client, Guild as DiscordGuild } from "discord.js";
import { prisma } from "@tina/database";

export async function ensurePermanentInvite(guild: DiscordGuild, fallbackChannelId: string): Promise<string | null> {
  const guildData = await prisma.guild.findUnique({ where: { id: guild.id } });

  if (guildData?.permanentInviteCode) {
    const invites = await guild.invites.fetch().catch(() => null);
    if (invites?.has(guildData.permanentInviteCode)) {
      return guildData.permanentInviteCode;
    }
  }

  const channelId = guildData?.permanentInviteChannelId ?? fallbackChannelId;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isThread()) return null;

  const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: false }).catch(() => null);
  if (!invite) return null;

  await prisma.guild.upsert({
    where: { id: guild.id },
    create: { id: guild.id, permanentInviteCode: invite.code, permanentInviteChannelId: channelId },
    update: { permanentInviteCode: invite.code, permanentInviteChannelId: channelId },
  });

  return invite.code;
}

export async function syncPermanentInvites(client: Client) {
  const guilds = await prisma.guild.findMany({ where: { permanentInviteChannelId: { not: null } } });

  for (const guildRecord of guilds) {
    if (!guildRecord.permanentInviteChannelId) continue;
    const guild = await client.guilds.fetch(guildRecord.id).catch(() => null);
    if (!guild) continue;
    await ensurePermanentInvite(guild, guildRecord.permanentInviteChannelId).catch(() => null);
  }
}
