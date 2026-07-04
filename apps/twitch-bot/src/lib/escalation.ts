import { prisma } from "@tina/database";
import type tmi from "tmi.js";
import { recordAndLog } from "./moderation.js";
import { banUser, type HelixContext } from "./helix.js";

const TIMEOUT_SECONDS = 600;
const ESCALATION_TYPES = ["AVERTISSEMENT", "TIMEOUT", "BAN"];

export async function applyAutoModEscalation(
  client: tmi.Client,
  ctx: HelixContext,
  broadcasterId: string,
  moderatorId: string,
  channel: string,
  username: string,
  targetUserId: string,
  reason: string,
  linkedGuildId: string | null,
): Promise<void> {
  const priorViolations = await prisma.twitchModerationCase.count({
    where: { username, type: { in: ESCALATION_TYPES } },
  });
  const violationNumber = priorViolations + 1;

  if (violationNumber < 3) {
    await client
      .say(channel, `@${username} attention, ton message a ete supprime (langage inapproprie). Avertissement ${violationNumber}/3 avant timeout.`)
      .catch((error) => console.error("Erreur lors de l'envoi de l'avertissement Twitch", error));
    await recordAndLog(linkedGuildId, username, "AVERTISSEMENT", reason);
    return;
  }

  if (violationNumber === 3) {
    const ok = await banUser(ctx, broadcasterId, moderatorId, targetUserId, reason, TIMEOUT_SECONDS);
    if (ok) {
      await client
        .say(channel, `@${username} a ete mis en timeout ${TIMEOUT_SECONDS / 60} minutes (langage inapproprie repete).`)
        .catch((error) => console.error("Erreur lors de l'envoi du message de timeout Twitch", error));
    }
    await recordAndLog(linkedGuildId, username, "TIMEOUT", reason);
    return;
  }

  const ok = await banUser(ctx, broadcasterId, moderatorId, targetUserId, reason);
  if (ok) {
    await client
      .say(channel, `@${username} a ete banni (recidive apres timeout).`)
      .catch((error) => console.error("Erreur lors de l'envoi du message de ban Twitch", error));
  }
  await recordAndLog(linkedGuildId, username, "BAN", reason);
}
