import { prisma } from "@tina/database";
import type tmi from "tmi.js";
import { recordAndLog } from "./moderation.js";

const TIMEOUT_SECONDS = 600;
const ESCALATION_TYPES = ["AVERTISSEMENT", "TIMEOUT", "BAN"];

export async function applyAutoModEscalation(
  client: tmi.Client,
  channel: string,
  username: string,
  reason: string,
  linkedGuildId: string | null,
): Promise<void> {
  const priorViolations = await prisma.twitchModerationCase.count({
    where: { username, type: { in: ESCALATION_TYPES } },
  });
  const violationNumber = priorViolations + 1;

  if (violationNumber < 3) {
    await client
      .say(channel, `@${username} attention, ton message a ete supprime (${reason}). Avertissement ${violationNumber}/3 avant timeout.`)
      .catch(() => null);
    await recordAndLog(linkedGuildId, username, "AVERTISSEMENT", reason);
    return;
  }

  if (violationNumber === 3) {
    await client.timeout(channel, username, TIMEOUT_SECONDS, reason).catch(() => null);
    await client.say(channel, `@${username} a ete mis en timeout ${TIMEOUT_SECONDS / 60} minutes (${reason}).`).catch(() => null);
    await recordAndLog(linkedGuildId, username, "TIMEOUT", reason);
    return;
  }

  await client.ban(channel, username, reason).catch(() => null);
  await client.say(channel, `@${username} a ete banni (recidive apres timeout : ${reason}).`).catch(() => null);
  await recordAndLog(linkedGuildId, username, "BAN", reason);
}
