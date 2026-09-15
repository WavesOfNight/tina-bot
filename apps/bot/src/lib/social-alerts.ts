import { EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { getBotConfig, prisma } from "@tina/database";
import { fetchRecentYoutubeVideos } from "./youtube-alerts.js";
import { fetchLiveStream } from "./twitch-alerts.js";

function applyAlertPlaceholders(template: string, channelName: string, url: string): string {
  return template.replaceAll("{channel}", channelName).replaceAll("{url}", url);
}

// Verifie toutes les alertes (ou seulement celles d'une guilde precise, voir options.guildId
// - utilise par /alertes verifier pour un rattrapage manuel) et envoie celles qui manquent.
// Renvoie le nombre de notifications effectivement envoyees, pour que l'appelant (la boucle
// periodique de ready.ts, ou la commande manuelle) puisse rendre compte du resultat.
export async function checkSocialAlerts(client: Client, options?: { guildId?: string }): Promise<{ sent: number }> {
  const alerts = await prisma.socialAlert.findMany({ where: options?.guildId ? { guildId: options.guildId } : undefined });
  if (alerts.length === 0) return { sent: 0 };

  const botConfig = await getBotConfig();
  let sent = 0;

  for (const alert of alerts) {
    try {
      if (alert.platform === "YOUTUBE") {
        const videos = await fetchRecentYoutubeVideos(alert.channelRef);
        if (videos.length === 0) continue; // deja logue dans fetchRecentYoutubeVideos

        const alreadyNotified = await prisma.notifiedYoutubeVideo.findMany({
          where: { alertId: alert.id },
          select: { videoId: true },
        });
        const notifiedIds = new Set(alreadyNotified.map((v) => v.videoId));

        if (notifiedIds.size === 0) {
          // Premiere verification pour cette alerte - on memorise l'existant comme point
          // de depart sans tout annoncer d'un coup (sinon spam de l'historique complet).
          await prisma.notifiedYoutubeVideo.createMany({
            data: videos.map((v) => ({ alertId: alert.id, videoId: v.videoId })),
          });
          console.log(`Alertes YouTube : premiere verification pour ${alert.channelRef}, ${videos.length} video(s) memorisee(s) sans annonce.`);
          continue;
        }

        const unnotified = videos.filter((v) => !notifiedIds.has(v.videoId));
        if (unnotified.length === 0) continue;

        const channel = (await client.channels.fetch(alert.discordChannelId).catch(() => null)) as TextChannel | null;
        if (!channel?.isTextBased()) {
          console.error(
            `Alertes YouTube : salon Discord ${alert.discordChannelId} introuvable ou inaccessible pour l'alerte #${alert.id} (${alert.channelRef}) - vérifie qu'il existe toujours et que le bot y a acces.`,
          );
          continue;
        }

        for (const video of unnotified) {
          const url = `https://www.youtube.com/watch?v=${video.videoId}`;
          const channelName = video.channelTitle || alert.channelRef;
          const embed = new EmbedBuilder()
            .setColor(0xd4537e)
            .setAuthor({ name: `▶️ ${channelName} a poste une nouvelle video !` })
            .setTitle(video.title)
            .setURL(url)
            .setImage(`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`)
            .setFooter({ text: "Tina [BOT] · Notification YouTube" })
            .setTimestamp(video.publishedAt);

          const delivered = await channel
            .send({ content: applyAlertPlaceholders(alert.message, channelName, url), embeds: [embed] })
            .then(() => true)
            .catch((error) => {
              console.error(`Alertes YouTube : echec de l'envoi du message pour l'alerte #${alert.id} (video ${video.videoId})`, error);
              return false;
            });

          // Marquee comme notifiee UNIQUEMENT si l'envoi a reussi - sinon elle reste
          // "non notifiee" et sera retentee au prochain cycle (ou via /alertes verifier)
          // au lieu d'etre perdue silencieusement.
          if (delivered) {
            await prisma.notifiedYoutubeVideo.create({ data: { alertId: alert.id, videoId: video.videoId } }).catch(() => null);
            sent += 1;
            console.log(`Alertes YouTube : nouvelle video annoncee pour ${alert.channelRef} dans #${channel.name} (${video.videoId}).`);
          }
        }
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

        const delivered = await channel
          .send({ content: applyAlertPlaceholders(alert.message, stream.userLogin, url), embeds: [embed] })
          .then(() => true)
          .catch((error) => {
            console.error(`Alertes Twitch : echec de l'envoi du message pour l'alerte #${alert.id}`, error);
            return false;
          });

        // Meme principe que YouTube : ne memoriser le live comme "vu" que si l'annonce a
        // reellement ete envoyee, sinon on retentera au prochain cycle.
        if (delivered) {
          await prisma.socialAlert.update({ where: { id: alert.id }, data: { lastSeenId: stream.streamId } });
          sent += 1;
          console.log(`Alertes Twitch : mise en direct annoncee pour ${stream.userLogin} dans #${channel.name}.`);
        }
      }
    } catch (error) {
      console.error(`Erreur lors de la verification de l'alerte sociale #${alert.id}`, error);
    }
  }

  return { sent };
}
