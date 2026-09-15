export interface YoutubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: Date;
}

// Le flux RSS YouTube liste jusqu'a 15 videos, de la plus recente a la plus ancienne.
// Recuperer toutes les entrees (pas juste la premiere) permet de rattraper les videos
// sorties entre deux verifications au lieu de ne voir que la toute derniere.
export async function fetchRecentYoutubeVideos(channelId: string): Promise<YoutubeVideo[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
    cache: "no-store",
  }).catch((error) => {
    console.error(`Alertes YouTube : impossible de contacter le flux RSS pour ${channelId}`, error);
    return null;
  });
  if (!res || !res.ok) {
    console.error(`Alertes YouTube : echec du flux RSS pour ${channelId} (status ${res?.status ?? "?"}) - verifie que l'ID de chaine est correct`);
    return [];
  }

  const xml = await res.text();
  const channelTitle = xml.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
  const entryMatches = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  if (entryMatches.length === 0) {
    console.error(`Alertes YouTube : aucune video trouvee dans le flux RSS pour ${channelId} (chaine sans video, ou ID de chaine invalide)`);
    return [];
  }

  const videos: YoutubeVideo[] = [];
  for (const [, entry] of entryMatches) {
    const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>(.*?)<\/title>/)?.[1];
    const published = entry.match(/<published>(.*?)<\/published>/)?.[1];
    if (!videoId || !title) continue;
    videos.push({ videoId, title, channelTitle, publishedAt: published ? new Date(published) : new Date() });
  }

  if (videos.length === 0) {
    console.error(`Alertes YouTube : flux RSS mal forme pour ${channelId}, impossible d'extraire les videos`);
  }

  // Plus ancienne en premier, pour annoncer dans l'ordre chronologique quand plusieurs
  // videos sont rattrapees d'un coup.
  return videos.reverse();
}
