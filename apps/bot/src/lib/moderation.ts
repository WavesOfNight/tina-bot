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
