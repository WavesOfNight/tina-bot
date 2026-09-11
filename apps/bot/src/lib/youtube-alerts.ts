interface LatestVideo {
  videoId: string;
  title: string;
  channelTitle: string;
}

export async function fetchLatestYoutubeVideo(channelId: string): Promise<LatestVideo | null> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
    cache: "no-store",
  }).catch((error) => {
    console.error(`Alertes YouTube : impossible de contacter le flux RSS pour ${channelId}`, error);
    return null;
  });
  if (!res || !res.ok) {
    console.error(`Alertes YouTube : echec du flux RSS pour ${channelId} (status ${res?.status ?? "?"}) - verifie que l'ID de chaine est correct`);
    return null;
  }

  const xml = await res.text();
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) {
    console.error(`Alertes YouTube : aucune video trouvee dans le flux RSS pour ${channelId} (chaine sans video, ou ID de chaine invalide)`);
    return null;
  }

  const entry = entryMatch[1];
  const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
  const title = entry.match(/<title>(.*?)<\/title>/)?.[1];
  const channelTitle = xml.match(/<title>(.*?)<\/title>/)?.[1] ?? "";

  if (!videoId || !title) {
    console.error(`Alertes YouTube : flux RSS mal forme pour ${channelId}, impossible d'extraire la video`);
    return null;
  }
  return { videoId, title, channelTitle };
}
