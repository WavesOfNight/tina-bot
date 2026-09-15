import { Events, type Client } from "discord.js";
import { checkExpiredGiveaways, postPendingGiveaways } from "../lib/giveaway.js";
import { syncReactionRoleMessages } from "../lib/reactionrole.js";
import { deployCommands } from "../lib/deploy.js";
import { startActivityRotation } from "../lib/activity-rotation.js";
import { checkExpiredTempBans } from "../lib/tempban.js";
import { checkSocialAlerts } from "../lib/social-alerts.js";
import { updateStatsChannels } from "../lib/stats-channel.js";
import { checkDueReminders } from "../lib/reminders.js";
import { syncRadioPlayback } from "../lib/radio.js";
import { syncPermanentInvites } from "../lib/invite.js";
import { cleanupEmptyTempChannels } from "../lib/hub-voice.js";

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>) {
  console.log(`Tina [BOT] connectee en tant que ${client.user.tag}`);
  await startActivityRotation(client);

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
    checkExpiredTempBans(client).catch((error) => console.error("Erreur lors de la verification des bans temporaires", error));
    checkDueReminders(client).catch((error) => console.error("Erreur lors de la verification des rappels", error));
    syncRadioPlayback(client).catch((error) => console.error("Erreur lors de la synchronisation de la radio", error));
    cleanupEmptyTempChannels(client).catch((error) => console.error("Erreur lors du nettoyage des salons vocaux personnalises", error));
  }, 15_000);

  setInterval(() => {
    // 60s plutot que 180s : une requete RSS/API par alerte est legere, et l'ecart entre
    // publication et notification comptait pour beaucoup dans le ressenti "pas instantane".
    checkSocialAlerts(client).catch((error) => console.error("Erreur lors de la verification des alertes sociales", error));
  }, 60_000);

  setInterval(() => {
    updateStatsChannels(client).catch((error) => console.error("Erreur lors de la mise a jour des salons de stats", error));
    syncPermanentInvites(client).catch((error) => console.error("Erreur lors de la synchronisation des invitations permanentes", error));
  }, 600_000);
}
