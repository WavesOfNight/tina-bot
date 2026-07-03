import "dotenv/config";
import tmi from "tmi.js";
import { findAutoModMatch, getTwitchBotConfig } from "@tina/database";
import { handleTwitchCommand } from "./lib/commands.js";
import { recordAndLog } from "./lib/moderation.js";
import { ensureFreshToken } from "./lib/token-refresh.js";

const POLL_INTERVAL_MS = 5_000;
const RETRY_COOLDOWN_MS = 30_000;

let currentClient: tmi.Client | null = null;
let currentSignature: string | null = null;
let lastAttemptedSignature: string | null = null;
let lastAttemptAt = 0;

function normalizeOauth(token: string): string {
  const trimmed = token.trim();
  return trimmed.startsWith("oauth:") ? trimmed : `oauth:${trimmed}`;
}

function createClient(username: string, accessToken: string, channelName: string): tmi.Client {
  const client = new tmi.Client({
    identity: { username, password: normalizeOauth(accessToken) },
    channels: [channelName],
  });

  client.on("message", async (channel, tags, message, self) => {
    if (self) return;

    const config = await getTwitchBotConfig().catch(() => null);
    if (!config || !config.enabled) return;

    const author = tags["display-name"] || tags.username || "quelqu'un";
    const isPrivileged = tags.badges?.broadcaster === "1" || Boolean(tags.mod);

    if (!isPrivileged && config.autoModLevel !== "OFF") {
      const matched = findAutoModMatch(config.autoModLevel, message);
      if (matched && tags.id) {
        await client.deletemessage(channel, tags.id).catch(() => null);
        await recordAndLog(config.linkedGuildId, author, "MESSAGE SUPPRIME", `mot filtre : "${matched}"`);
        return;
      }
    }

    await handleTwitchCommand(client, channel, config.prefix, message, author).catch((error) =>
      console.error("Erreur lors du traitement d'une commande Twitch", error),
    );
  });

  client.on("connected", () => console.log(`Tina [BOT] Twitch connectee sur #${channelName}`));
  client.on("disconnected", (reason) => console.log(`Deconnectee de Twitch : ${reason}`));

  return client;
}

async function supervise() {
  const config = await getTwitchBotConfig().catch((error) => {
    console.error("Impossible de lire la configuration du bot Twitch depuis la base de donnees", error);
    return null;
  });

  if (!config || !config.enabled) {
    if (currentClient) {
      console.log("Bot Twitch desactive ou configuration supprimee, deconnexion.");
      await currentClient.disconnect().catch(() => null);
      currentClient = null;
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

  if (!accessToken) {
    console.log("Aucun token Twitch valide : connecte-toi via le panel web (Bot Twitch).");
    return;
  }

  const signature = `${config.username}:${accessToken}:${config.channelName}`;
  if (signature === currentSignature) return;

  const now = Date.now();
  if (signature === lastAttemptedSignature && now - lastAttemptAt < RETRY_COOLDOWN_MS) return;

  if (currentClient) {
    console.log("Configuration ou token Twitch mis a jour, reconnexion...");
    await currentClient.disconnect().catch(() => null);
    currentClient = null;
    currentSignature = null;
  }

  lastAttemptedSignature = signature;
  lastAttemptAt = now;

  const client = createClient(config.username, accessToken, config.channelName);
  try {
    await client.connect();
    currentClient = client;
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
