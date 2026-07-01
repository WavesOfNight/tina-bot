import { ActivityType, Events, type Client } from "discord.js";
import { checkExpiredGiveaways, postPendingGiveaways } from "../lib/giveaway.js";
import { syncReactionRoleMessages } from "../lib/reactionrole.js";
import { deployCommands } from "../lib/deploy.js";

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>) {
  console.log(`Tina [BOT] connectee en tant que ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "sur le panel web de Tina", type: ActivityType.Watching }],
    status: "online",
  });

  if (client.token) {
    const count = await deployCommands(client.application.id, client.token).catch((error) => {
      console.error("Echec du deploiement automatique des commandes", error);
      return 0;
    });
    if (count) console.log(`${count} commande(s) slash synchronisee(s).`);
  }

  setInterval(() => {
    checkExpiredGiveaways(client).catch((error) => console.error("Erreur lors de la verification des giveaways", error));
    postPendingGiveaways(client).catch((error) => console.error("Erreur lors de la publication des giveaways", error));
    syncReactionRoleMessages(client).catch((error) => console.error("Erreur lors de la synchro reaction-role", error));
  }, 15_000);
}
