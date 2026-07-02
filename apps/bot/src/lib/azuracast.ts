const NOWPLAYING_URL = "https://radio.reads-records.com/api/nowplaying/reads_radio";

export interface AzuraCastSong {
  id: string;
  text: string;
  artist: string;
  title: string;
  album: string;
  genre: string;
  art: string;
}

export interface AzuraCastHistoryItem {
  sh_id: number;
  played_at: number;
  duration: number;
  playlist: string;
  streamer: string;
  is_request: boolean;
  song: AzuraCastSong;
}

export interface AzuraCastNowPlaying {
  station: { name: string; listen_url: string };
  listeners: { total: number; unique: number; current: number };
  live: { is_live: boolean; streamer_name: string };
  now_playing: {
    sh_id: number;
    played_at: number;
    duration: number;
    elapsed: number;
    remaining: number;
    song: AzuraCastSong;
  };
  playing_next: { duration: number; song: AzuraCastSong } | null;
  song_history: AzuraCastHistoryItem[];
}

export async function fetchNowPlaying(): Promise<AzuraCastNowPlaying | null> {
  const res = await fetch(NOWPLAYING_URL, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json().catch(() => null)) as AzuraCastNowPlaying | null;
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function progressBar(elapsed: number, duration: number, size = 18): string {
  if (!duration) return "";
  const ratio = Math.min(1, Math.max(0, elapsed / duration));
  const filled = Math.min(size - 1, Math.round(ratio * size));
  return "▬".repeat(filled) + "🔘" + "▬".repeat(Math.max(0, size - filled - 1));
}
