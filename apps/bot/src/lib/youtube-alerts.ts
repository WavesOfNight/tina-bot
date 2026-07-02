interface LatestVideo {
  videoId: string;
  title: string;
  channelTitle: string;
}

export async function fetchLatestYoutubeVideo(channelId: string): Promise<LatestVideo | null> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) return null;

  const xml = await res.text();
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) return null;

  const entry = entryMatch[1];
  const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
  const title = entry.match(/<title>(.*?)<\/title>/)?.[1];
  const channelTitle = xml.match(/<title>(.*?)<\/title>/)?.[1] ?? "";

  if (!videoId || !title) return null;
  return { videoId, title, channelTitle };
}
