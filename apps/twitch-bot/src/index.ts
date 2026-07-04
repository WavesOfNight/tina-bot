import "dotenv/config";
import tmi from "tmi.js";
import { findAutoModMatch, getTwitchBotConfig } from "@tina/database";
import { handleTwitchCommand } from "./lib/commands.js";
import { applyAutoModEscalation } from "./lib/escalation.js";
import { ensureFreshToken } from "./lib/token-refresh.js";
import { deleteChatMessage, getAuthenticatedUserId, getUserId, type HelixContext } from "./lib/helix.js";

const POLL_INTERVAL_MS = 5_000;
const RETRY_COOLDOWN_MS = 30_000;

interface Session {
  client: tmi.Client;
  ctx: HelixContext;
  broadcasterId: string;
  moderatorId: string;
}

let currentSession: Session | null = null;
let currentSignature: string | null = null;
let lastAttemptedSignature: string | null = null;
let lastAttemptAt = 0;

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

  client.on("message", async (channel, tags, message, self) => {
    if (self) return;

    const config = await getTwitchBotConfig().catch(() => null);
    if (!config || !config.enabled) return;

    const author = tags["display-name"] || tags.username || "quelqu'un";
    const loginName = tags.username;
    const isPrivileged = tags.badges?.broadcaster === "1" || Boolean(tags.mod);

    if (!isPrivileged && config.autoModLevel !== "OFF") {
      const matched = findAutoModMatch(config.autoModLevel, message);
      if (matched && tags.id && loginName) {
        const targetUserId = await getUserId(ctx, loginName).catch(() => null);

        await deleteChatMessage(ctx, broadcasterId, moderatorId, tags.id).catch((error) =>
          console.error(`Echec de la suppression du message Twitch (id=${tags.id}, auteur=${loginName})`, error),
        );

        if (targetUserId) {
          await applyAutoModEscalation(
            client,
            ctx,
            broadcasterId,
            moderatorId,
            channel,
            loginName,
            targetUserId,
            `mot filtre : "${matched}"`,
            config.linkedGuildId,
          );
        } else {
          console.error(`Impossible de resoudre l'ID Twitch de ${loginName}, timeout/ban impossible.`);
        }
        return;
      }
    }

    await handleTwitchCommand(client, channel, config.prefix, message, author).catch((error) =>
      console.error("Erreur lors du traitement d'une commande Twitch", error),
    );
  });

  client.on("connected", () => console.log(`Tina [BOT] Twitch connectee sur #${channelName}`));
  client.on("disconnected", (reason) => console.log(`Deconnectee de Twitch : ${reason}`));

  return { client, ctx, broadcasterId, moderatorId };
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

supervise();
setInterval(() => {
  supervise().catch((error) => console.error("Erreur lors de la supervision du bot Twitch", error));
}, POLL_INTERVAL_MS);
