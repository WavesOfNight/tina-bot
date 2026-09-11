import { EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { getBotConfig, prisma } from "@tina/database";
import { fetchLatestYoutubeVideo } from "./youtube-alerts.js";
import { fetchLiveStream } from "./twitch-alerts.js";

function applyAlertPlaceholders(template: string, channelName: string, url: string): string {
  return template.replaceAll("{channel}", channelName).replaceAll("{url}", url);
}

export async function checkSocialAlerts(client: Client) {
  const alerts = await prisma.socialAlert.findMany();
  if (alerts.length === 0) return;

  const botConfig = await getBotConfig();

  for (const alert of alerts) {
    try {
      if (alert.platform === "YOUTUBE") {
        const latest = await fetchLatestYoutubeVideo(alert.channelRef);
        if (!latest) continue; // deja logue dans fetchLatestYoutubeVideo
        if (latest.videoId === alert.lastSeenId) continue;

        const isFirstRun = !alert.lastSeenId;
        await prisma.socialAlert.update({ where: { id: alert.id }, data: { lastSeenId: latest.videoId } });
        if (isFirstRun) {
          console.log(`Alertes YouTube : premiere verification pour ${alert.channelRef}, video actuelle memorisee sans annonce.`);
          continue;
        }

        const channel = (await client.channels.fetch(alert.discordChannelId).catch(() => null)) as TextChannel | null;
        if (!channel?.isTextBased()) {
          console.error(
            `Alertes YouTube : salon Discord ${alert.discordChannelId} introuvable ou inaccessible pour l'alerte #${alert.id} (${alert.channelRef}) - vérifie qu'il existe toujours et que le bot y a acces.`,
          );
          continue;
        }

        const url = `https://www.youtube.com/watch?v=${latest.videoId}`;
        const channelName = latest.channelTitle || alert.channelRef;
        const embed = new EmbedBuilder()
          .setColor(0xd4537e)
          .setAuthor({ name: `▶️ ${channelName} a poste une nouvelle video !` })
          .setTitle(latest.title)
          .setURL(url)
          .setImage(`https://i.ytimg.com/vi/${latest.videoId}/hqdefault.jpg`)
          .setFooter({ text: "Tina [BOT] · Notification YouTube" })
          .setTimestamp();

        await channel
          .send({ content: applyAlertPlaceholders(alert.message, channelName, url), embeds: [embed] })
          .then(() => console.log(`Alertes YouTube : nouvelle video annoncee pour ${alert.channelRef} dans #${channel.name}.`))
          .catch((error) => console.error(`Alertes YouTube : echec de l'envoi du message pour l'alerte #${alert.id}`, error));
      }

      if (alert.platform === "TWITCH") {
        if (!botConfig?.twitchClientId || !botConfig.twitchClientSecret) {
          console.error(
            `Alertes Twitch : Client ID/Secret Twitch non configures (Panel -> Parametres) - l'alerte #${alert.id} (${alert.channelRef}) ne peut pas etre verifiee.`,
          );
          continue;
        }

        const stream = await fetchLiveStream(botConfig.twitchClientId, botConfig.twitchClientSecret, alert.channelRef);
        if (!stream) continue; // pas en direct, ou erreur deja loguee dans fetchLiveStream
        if (stream.streamId === alert.lastSeenId) continue;

        await prisma.socialAlert.update({ where: { id: alert.id }, data: { lastSeenId: stream.streamId } });

        const channel = (await client.channels.fetch(alert.discordChannelId).catch(() => null)) as TextChannel | null;
        if (!channel?.isTextBased()) {
          console.error(
            `Alertes Twitch : salon Discord ${alert.discordChannelId} introuvable ou inaccessible pour l'alerte #${alert.id} (${alert.channelRef}) - vérifie qu'il existe toujours et que le bot y a acces.`,
          );
          continue;
        }

        const url = `https://twitch.tv/${stream.userLogin}`;
        const embed = new EmbedBuilder()
          .setColor(0x7f77dd)
          .setAuthor({ name: `🔴 ${stream.userLogin} est en direct sur Twitch !` })
          .setTitle(stream.title)
          .setURL(url)
          .addFields({ name: "🎮 Categorie", value: stream.gameName || "Non renseignee", inline: true })
          .setImage(stream.thumbnailUrl)
          .setFooter({ text: "Tina [BOT] · Notification Twitch" })
          .setTimestamp();

        await channel
          .send({ content: applyAlertPlaceholders(alert.message, stream.userLogin, url), embeds: [embed] })
          .then(() => console.log(`Alertes Twitch : mise en direct annoncee pour ${stream.userLogin} dans #${channel.name}.`))
          .catch((error) => console.error(`Alertes Twitch : echec de l'envoi du message pour l'alerte #${alert.id}`, error));
      }
    } catch (error) {
      console.error(`Erreur lors de la verification de l'alerte sociale #${alert.id}`, error);
    }
  }
}
