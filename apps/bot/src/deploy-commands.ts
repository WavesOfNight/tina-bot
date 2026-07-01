import { getBotConfig } from "@tina/database";
import { deployCommands } from "./lib/deploy.js";

async function main() {
  const botConfig = await getBotConfig();
  if (!botConfig) {
    console.error("Aucun token configure. Renseigne le token du bot depuis le panel web (Parametres) avant de deployer les commandes.");
    process.exitCode = 1;
    return;
  }

  try {
    const count = await deployCommands(botConfig.clientId, botConfig.token);
    console.log(`${count} commande(s) deployee(s).`);
  } catch (error) {
    console.error("Echec du deploiement des commandes", error);
    process.exitCode = 1;
  }
}

main();
