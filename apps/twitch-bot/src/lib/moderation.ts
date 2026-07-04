import { prisma, incrementTwitchDailyStat } from "@tina/database";
import { sendDiscordLog } from "./discord-log.js";

export async function recordAndLog(
  linkedGuildId: string | null,
  username: string,
  type: string,
  reason: string,
): Promise<void> {
  await prisma.twitchModerationCase.create({ data: { username, type, reason } });
  if (type === "TIMEOUT" || type === "BAN") {
    await incrementTwitchDailyStat("timeouts").catch(() => null);
  }
  await sendDiscordLog(linkedGuildId, `🟣 **Twitch - ${type}** — ${username} : ${reason}`);
}
