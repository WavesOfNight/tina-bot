import { prisma } from "@tina/database";
import type tmi from "tmi.js";
import { recordAndLog } from "./moderation.js";
import { sendDiscordLog } from "./discord-log.js";
import { banUser, sendWarning, type HelixContext } from "./helix.js";

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
    await sendWarning(ctx, broadcasterId, moderatorId, targetUserId, reason).catch(() => false);
    await client
      .say(channel, `@${username} attention, ton message a été supprimé (langage inapproprié). Avertissement ${violationNumber}/3 avant timeout.`)
      .catch((error) => console.error("Erreur lors de l'envoi de l'avertissement Twitch", error));
    await recordAndLog(linkedGuildId, username, "AVERTISSEMENT", reason);
    return;
  }

  if (violationNumber === 3) {
    const ok = await banUser(ctx, broadcasterId, moderatorId, targetUserId, reason, TIMEOUT_SECONDS);
    if (ok) {
      await client
        .say(channel, `@${username} a été mis en timeout ${TIMEOUT_SECONDS / 60} minutes (langage inapproprié répété).`)
        .catch((error) => console.error("Erreur lors de l'envoi du message de timeout Twitch", error));
      await recordAndLog(linkedGuildId, username, "TIMEOUT", reason);
    } else {
      console.error(`Le timeout Twitch de ${username} a échoué cote Helix, aucun log de reussite enregistre.`);
      await sendDiscordLog(linkedGuildId, `🟣 **Twitch - Échec timeout** — ${username} : la demande de timeout a été refusée par Twitch (voir les logs du bot).`);
    }
    return;
  }

  const ok = await banUser(ctx, broadcasterId, moderatorId, targetUserId, reason);
  if (ok) {
    await client
      .say(channel, `@${username} a été banni (récidive après timeout).`)
      .catch((error) => console.error("Erreur lors de l'envoi du message de ban Twitch", error));
    await recordAndLog(linkedGuildId, username, "BAN", reason);
  } else {
    console.error(`Le ban Twitch de ${username} a échoué cote Helix, aucun log de reussite enregistre.`);
    await sendDiscordLog(linkedGuildId, `🟣 **Twitch - Échec ban** — ${username} : la demande de ban a été refusée par Twitch (voir les logs du bot).`);
  }
}
