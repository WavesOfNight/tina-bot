import { Client, GatewayIntentBits, Partials } from "discord.js";
import { getBotConfig } from "@tina/database";
import "./config.js";
import { events } from "./events/index.js";

const POLL_INTERVAL_MS = 5_000;

let currentClient: Client | null = null;
let currentToken: string | null = null;

function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
  });

  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...(args as [never])));
    } else {
      client.on(event.name, (...args) => event.execute(...(args as [never])));
    }
  }

  client.on("error", (error) => console.error("Erreur du client Discord", error));

  return client;
}

async function supervise() {
  const botConfig = await getBotConfig().catch((error) => {
    console.error("Impossible de lire la configuration du bot depuis la base de donnees", error);
    return null;
  });

  if (!botConfig) {
    if (currentClient) {
      console.log("Configuration du bot supprimee, deconnexion.");
      await currentClient.destroy();
      currentClient = null;
      currentToken = null;
    } else {
      console.log("En attente du token du bot (a renseigner depuis le panel web > Parametres)...");
    }
    return;
  }

  if (botConfig.token === currentToken) return;

  if (currentClient) {
    console.log("Token mis a jour, reconnexion de Tina [BOT]...");
    await currentClient.destroy();
    currentClient = null;
  }

  currentToken = botConfig.token;
  const client = createClient();

  try {
    await client.login(botConfig.token);
    currentClient = client;
  } catch (error) {
    console.error("Connexion impossible avec le token fourni. Verifie-le dans le panel web > Parametres.", error);
  }
}

supervise();
setInterval(() => {
  supervise().catch((error) => console.error("Erreur lors de la supervision du bot", error));
}, POLL_INTERVAL_MS);
