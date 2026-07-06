import type { EmbedBuilder, Guild } from "discord.js";
import { prisma } from "@tina/database";

export async function sendLogEmbed(guild: Guild, embed: EmbedBuilder): Promise<void> {
  const guildRecord = await prisma.guild.findUnique({ where: { id: guild.id } });
  if (!guildRecord?.modLogChannelId) return;

  const channel = guild.channels.cache.get(guildRecord.modLogChannelId);
  if (channel?.isTextBased()) await channel.send({ embeds: [embed] }).catch(() => null);
}
