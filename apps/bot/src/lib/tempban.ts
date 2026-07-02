import type { Client } from "discord.js";
import { prisma } from "@tina/database";
import { logCase } from "./moderation.js";

export async function checkExpiredTempBans(client: Client) {
  const expired = await prisma.moderationCase.findMany({
    where: { type: "BAN", resolved: false, expiresAt: { not: null, lte: new Date() } },
  });

  for (const banCase of expired) {
    await prisma.moderationCase.update({ where: { id: banCase.id }, data: { resolved: true } });

    const guild = await client.guilds.fetch(banCase.guildId).catch(() => null);
    if (!guild) continue;

    const unbanned = await guild.members.unban(banCase.userId, "Ban temporaire expire").catch(() => null);
    if (unbanned) {
      await logCase({
        guild,
        userId: banCase.userId,
        moderatorId: client.user!.id,
        type: "UNBAN",
        reason: "Ban temporaire expire",
      });
    }
  }
}
