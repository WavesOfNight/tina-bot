import type { Client } from "discord.js";
import { prisma } from "@tina/database";

export async function updateStatsChannels(client: Client) {
  const guilds = await prisma.guild.findMany({ where: { statsChannelId: { not: null } } });

  for (const guildRecord of guilds) {
    const guild = await client.guilds.fetch(guildRecord.id).catch(() => null);
    if (!guild) continue;

    const channel = await guild.channels.fetch(guildRecord.statsChannelId!).catch(() => null);
    if (!channel) continue;

    const memberCount = guild.memberCount;
    const newName = `📊 Membres : ${memberCount}`;
    if (channel.name !== newName) {
      await channel.setName(newName).catch(() => null);
    }
  }
}
