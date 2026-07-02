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
        if (!latest) continue;
        if (latest.videoId === alert.lastSeenId) continue;

        const isFirstRun = !alert.lastSeenId;
        await prisma.socialAlert.update({ where: { id: alert.id }, data: { lastSeenId: latest.videoId } });
        if (isFirstRun) continue;

        const channel = (await client.channels.fetch(alert.discordChannelId).catch(() => null)) as TextChannel | null;
        if (!channel?.isTextBased()) continue;

        const url = `https://www.youtube.com/watch?v=${latest.videoId}`;
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle(latest.title)
          .setURL(url)
          .setAuthor({ name: latest.channelTitle || alert.channelRef })
          .setDescription("Nouvelle video disponible !");

        await channel
          .send({ content: applyAlertPlaceholders(alert.message, latest.channelTitle || alert.channelRef, url), embeds: [embed] })
          .catch(() => null);
      }

      if (alert.platform === "TWITCH") {
        if (!botConfig?.twitchClientId || !botConfig.twitchClientSecret) continue;

        const stream = await fetchLiveStream(botConfig.twitchClientId, botConfig.twitchClientSecret, alert.channelRef);
        if (!stream || stream.streamId === alert.lastSeenId) continue;

        await prisma.socialAlert.update({ where: { id: alert.id }, data: { lastSeenId: stream.streamId } });

        const channel = (await client.channels.fetch(alert.discordChannelId).catch(() => null)) as TextChannel | null;
        if (!channel?.isTextBased()) continue;

        const url = `https://twitch.tv/${stream.userLogin}`;
        const embed = new EmbedBuilder()
          .setColor(0x9146ff)
          .setTitle(stream.title)
          .setURL(url)
          .setAuthor({ name: stream.userLogin })
          .setDescription(`En direct sur ${stream.gameName || "Twitch"} !`)
          .setImage(stream.thumbnailUrl);

        await channel.send({ content: applyAlertPlaceholders(alert.message, stream.userLogin, url), embeds: [embed] }).catch(() => null);
      }
    } catch (error) {
      console.error(`Erreur lors de la verification de l'alerte sociale #${alert.id}`, error);
    }
  }
}
