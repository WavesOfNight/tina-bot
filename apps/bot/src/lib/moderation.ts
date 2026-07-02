import { EmbedBuilder, type Guild, type TextChannel } from "discord.js";
import { prisma } from "@tina/database";

export type ModerationType = "WARN" | "MUTE" | "UNMUTE" | "KICK" | "BAN" | "UNBAN" | "AUTOMOD";

export async function logCase(params: {
  guild: Guild;
  userId: string;
  moderatorId: string;
  type: ModerationType;
  reason?: string | null;
  expiresAt?: Date | null;
}) {
  await prisma.guild.upsert({ where: { id: params.guild.id }, create: { id: params.guild.id }, update: {} });

  const moderationCase = await prisma.moderationCase.create({
    data: {
      guildId: params.guild.id,
      userId: params.userId,
      moderatorId: params.moderatorId,
      type: params.type,
      reason: params.reason ?? null,
      expiresAt: params.expiresAt ?? null,
    },
  });

  const guildRecord = await prisma.guild.findUnique({ where: { id: params.guild.id } });
  if (guildRecord?.modLogChannelId) {
    const channel = params.guild.channels.cache.get(guildRecord.modLogChannelId) as TextChannel | undefined;
    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xd85a30)
        .setTitle(`Cas #${moderationCase.id} - ${params.type}`)
        .addFields(
          { name: "Membre", value: `<@${params.userId}>`, inline: true },
          { name: "Moderateur", value: `<@${params.moderatorId}>`, inline: true },
          { name: "Raison", value: params.reason ?? "Aucune raison fournie" },
        )
        .setTimestamp();
      await channel.send({ embeds: [embed] }).catch(() => null);
    }
  }

  return moderationCase;
}

export async function applyWarnEscalation(guild: Guild, userId: string) {
  const guildRecord = await prisma.guild.findUnique({ where: { id: guild.id } });
  if (!guildRecord) return;

  const warnCount = await prisma.moderationCase.count({
    where: { guildId: guild.id, userId, type: { in: ["WARN", "AUTOMOD"] } },
  });
  const moderatorId = guild.client.user.id;

  if (guildRecord.warnBanThreshold && warnCount >= guildRecord.warnBanThreshold) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member?.bannable) {
      await guild.members.ban(userId, { reason: `Escalade automatique (${warnCount} avertissements)` }).catch(() => null);
      await logCase({ guild, userId, moderatorId, type: "BAN", reason: `Escalade automatique (${warnCount} avertissements)` });
    }
    return;
  }

  if (guildRecord.warnKickThreshold && warnCount >= guildRecord.warnKickThreshold) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member?.kickable) {
      await member.kick(`Escalade automatique (${warnCount} avertissements)`).catch(() => null);
      await logCase({ guild, userId, moderatorId, type: "KICK", reason: `Escalade automatique (${warnCount} avertissements)` });
    }
    return;
  }

  if (guildRecord.warnMuteThreshold && warnCount >= guildRecord.warnMuteThreshold) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member?.moderatable) {
      const durationMs = 24 * 60 * 60 * 1000;
      await member.timeout(durationMs, `Escalade automatique (${warnCount} avertissements)`).catch(() => null);
      await logCase({
        guild,
        userId,
        moderatorId,
        type: "MUTE",
        reason: `Escalade automatique (${warnCount} avertissements)`,
        expiresAt: new Date(Date.now() + durationMs),
      });
    }
  }
}
