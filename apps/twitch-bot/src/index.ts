import "dotenv/config";
import tmi from "tmi.js";
import {
  findAutoModMatch,
  getTwitchBotConfig,
  incrementTwitchChatterStat,
  incrementTwitchDailyStat,
  getActiveTwitchGiveaway,
  addTwitchGiveawayEntry,
  getTwitchGiveawayHistory,
  getEnabledTwitchTimers,
  markTwitchTimerSent,
} from "@tina/database";
import { handleTwitchCommand } from "./lib/commands.js";
import { applyAutoModEscalation } from "./lib/escalation.js";
import { ensureFreshToken } from "./lib/token-refresh.js";
import { findGranularFilterMatch } from "./lib/filters.js";
import { deleteChatMessage, getAuthenticatedUserId, getUserId, sendShoutout, type HelixContext } from "./lib/helix.js";

const POLL_INTERVAL_MS = 5_000;
const RETRY_COOLDOWN_MS = 30_000;
const TIMER_CHECK_INTERVAL_MS = 30_000;

interface Session {
  client: tmi.Client;
  ctx: HelixContext;
  broadcasterId: string;
  moderatorId: string;
  channel: string;
}

let currentSession: Session | null = null;
let currentSignature: string | null = null;
let lastAttemptedSignature: string | null = null;
let lastAttemptAt = 0;

let messageCounter = 0;
const timerMessageBaseline = new Map<number, number>();
let announcedActiveGiveawayId: number | null = null;
let announcedEndedGiveawayId: number | null = null;

function normalizeOauth(token: string): string {
  const trimmed = token.trim();
  return trimmed.startsWith("oauth:") ? trimmed : `oauth:${trimmed}`;
}

async function buildSession(
  username: string,
  accessToken: string,
  channelName: string,
  clientId: string,
): Promise<Session | null> {
  const ctx: HelixContext = { clientId, accessToken };

  const [broadcasterId, moderatorId] = await Promise.all([getUserId(ctx, channelName), getAuthenticatedUserId(ctx)]);
  if (!broadcasterId || !moderatorId) {
    console.error(
      "Impossible de resoudre les identifiants Twitch (broadcaster/moderateur) via Helix. Verifie le Client ID/Secret et que le token a bien ete autorise.",
    );
    return null;
  }

  const client = new tmi.Client({
    identity: { username, password: normalizeOauth(accessToken) },
    channels: [channelName],
  });
  const channel = `#${channelName}`;

  client.on("message", async (channelArg, tags, message, self) => {
    if (self) return;

    const config = await getTwitchBotConfig().catch(() => null);
    if (!config || !config.enabled) return;

    const author = tags["display-name"] || tags.username || "quelqu'un";
    const loginName = tags.username;
    const isPrivileged = tags.badges?.broadcaster === "1" || Boolean(tags.mod);

    messageCounter++;
    await incrementTwitchDailyStat("messages").catch(() => null);
    if (loginName) await incrementTwitchChatterStat(loginName).catch(() => null);

    const activeGiveaway = await getActiveTwitchGiveaway().catch(() => null);
    if (activeGiveaway && loginName && message.trim().toLowerCase() === activeGiveaway.keyword.toLowerCase()) {
      await addTwitchGiveawayEntry(activeGiveaway.id, loginName).catch(() => false);
      return;
    }

    const shoutoutPrefix = `${config.prefix}so `;
    if (isPrivileged && message.toLowerCase().startsWith(shoutoutPrefix)) {
      const target = message.slice(shoutoutPrefix.length).trim().replace(/^@/, "").toLowerCase();
      if (target) {
        const targetId = await getUserId(ctx, target).catch(() => null);
        if (targetId) {
          const ok = await sendShoutout(ctx, broadcasterId, moderatorId, targetId).catch(() => false);
          if (ok) {
            await client.say(channelArg, `Va faire un tour sur la chaine de @${target} ! https://twitch.tv/${target}`).catch(() => null);
          }
        }
      }
      return;
    }

    if (!isPrivileged) {
      let matchedReason: string | null = null;
      let shouldPunish = true;

      if (config.autoModLevel !== "OFF") {
        const matchedWord = findAutoModMatch(config.autoModLevel, message);
        if (matchedWord) matchedReason = `mot filtre : "${matchedWord}"`;
      }
      if (!matchedReason) {
        const granular = findGranularFilterMatch(config, tags, channelArg, message);
        if (granular) {
          matchedReason = granular.reason;
          shouldPunish = granular.punish;
        }
      }

      if (matchedReason && tags.id && loginName) {
        await deleteChatMessage(ctx, broadcasterId, moderatorId, tags.id).catch((error) =>
          console.error(`Echec de la suppression du message Twitch (id=${tags.id}, auteur=${loginName})`, error),
        );

        if (!shouldPunish) return;

        const targetUserId = await getUserId(ctx, loginName).catch(() => null);
        if (targetUserId) {
          await applyAutoModEscalation(
            client,
            ctx,
            broadcasterId,
            moderatorId,
            channelArg,
            loginName,
            targetUserId,
            matchedReason,
            config.linkedGuildId,
          );
        } else {
          console.error(`Impossible de resoudre l'ID Twitch de ${loginName}, timeout/ban impossible.`);
        }
        return;
      }
    }

    await handleTwitchCommand(client, channelArg, config.prefix, message, author).catch((error) =>
      console.error("Erreur lors du traitement d'une commande Twitch", error),
    );
  });

  client.on("connected", () => console.log(`Tina [BOT] Twitch connectee sur #${channelName}`));
  client.on("disconnected", (reason) => console.log(`Deconnectee de Twitch : ${reason}`));

  return { client, ctx, broadcasterId, moderatorId, channel };
}

async function supervise() {
  const config = await getTwitchBotConfig().catch((error) => {
    console.error("Impossible de lire la configuration du bot Twitch depuis la base de donnees", error);
    return null;
  });

  if (!config || !config.enabled) {
    if (currentSession) {
      console.log("Bot Twitch desactive ou configuration supprimee, deconnexion.");
      await currentSession.client.disconnect().catch(() => null);
      currentSession = null;
      currentSignature = null;
    } else {
      console.log("En attente de la configuration du bot Twitch (a renseigner depuis le panel web)...");
    }
    return;
  }

  const accessToken = await ensureFreshToken(config).catch((error) => {
    console.error("Erreur lors du rafraichissement du token Twitch", error);
    return config.accessToken;
  });

  if (!accessToken || !config.clientId) {
    console.log("Aucun token ou Client ID Twitch valide : connecte-toi via le panel web (Bot Twitch).");
    return;
  }

  const signature = `${config.username}:${accessToken}:${config.channelName}`;
  if (signature === currentSignature) return;

  const now = Date.now();
  if (signature === lastAttemptedSignature && now - lastAttemptAt < RETRY_COOLDOWN_MS) return;

  if (currentSession) {
    console.log("Configuration ou token Twitch mis a jour, reconnexion...");
    await currentSession.client.disconnect().catch(() => null);
    currentSession = null;
    currentSignature = null;
  }

  lastAttemptedSignature = signature;
  lastAttemptAt = now;

  const session = await buildSession(config.username, accessToken, config.channelName, config.clientId);
  if (!session) return;

  try {
    await session.client.connect();
    currentSession = session;
    currentSignature = signature;
  } catch (error) {
    console.error(
      "Connexion Twitch impossible avec les identifiants fournis. Nouvelle tentative dans 30s. Verifie la configuration dans le panel web.",
      error,
    );
  }
}

async function runTimers() {
  if (!currentSession) return;
  const config = await getTwitchBotConfig().catch(() => null);
  if (!config || !config.enabled) return;

  const timers = await getEnabledTwitchTimers().catch(() => []);
  const now = Date.now();

  for (const timer of timers) {
    const last = timer.lastSentAt?.getTime() ?? 0;
    const elapsedOk = now - last >= timer.intervalMinutes * 60_000;
    const sentSince = messageCounter - (timerMessageBaseline.get(timer.id) ?? 0);
    if (!elapsedOk || sentSince < timer.minMessages) continue;

    await currentSession.client.say(currentSession.channel, timer.message).catch((error) =>
      console.error(`Erreur lors de l'envoi du timer Twitch "${timer.name}"`, error),
    );
    timerMessageBaseline.set(timer.id, messageCounter);
    await markTwitchTimerSent(timer.id).catch(() => null);
  }
}

async function checkGiveawayAnnouncements() {
  if (!currentSession) return;

  const active = await getActiveTwitchGiveaway().catch(() => null);
  if (active && active.id !== announcedActiveGiveawayId) {
    announcedActiveGiveawayId = active.id;
    await currentSession.client
      .say(currentSession.channel, `🎉 Giveaway lance ! Tape "${active.keyword}" dans le chat pour tenter de gagner : ${active.prize}`)
      .catch(() => null);
    return;
  }

  if (!active) {
    const [lastEnded] = await getTwitchGiveawayHistory(1).catch(() => []);
    if (lastEnded && lastEnded.id !== announcedEndedGiveawayId) {
      announcedEndedGiveawayId = lastEnded.id;
      if (lastEnded.status === "CANCELLED") {
        await currentSession.client.say(currentSession.channel, `Le giveaway pour "${lastEnded.prize}" a ete annule.`).catch(() => null);
      } else if (lastEnded.winnerUsername) {
        await currentSession.client
          .say(currentSession.channel, `🎉 Le giveaway est termine ! Felicitations a @${lastEnded.winnerUsername} qui remporte : ${lastEnded.prize}`)
          .catch(() => null);
      } else {
        await currentSession.client
          .say(currentSession.channel, `Le giveaway pour "${lastEnded.prize}" est termine, mais personne n'a participe.`)
          .catch(() => null);
      }
    }
  }
}

supervise();
setInterval(() => {
  supervise().catch((error) => console.error("Erreur lors de la supervision du bot Twitch", error));
}, POLL_INTERVAL_MS);
setInterval(() => {
  checkGiveawayAnnouncements().catch((error) => console.error("Erreur lors de l'annonce du giveaway Twitch", error));
}, POLL_INTERVAL_MS);
setInterval(() => {
  runTimers().catch((error) => console.error("Erreur lors de l'execution des timers Twitch", error));
}, TIMER_CHECK_INTERVAL_MS);
