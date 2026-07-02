interface TwitchToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: TwitchToken | null = null;

async function getAppAccessToken(clientId: string, clientSecret: string): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.accessToken;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params.toString()}`, { method: "POST" }).catch(() => null);
  if (!res || !res.ok) return null;

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.accessToken;
}

export interface LiveStream {
  streamId: string;
  title: string;
  gameName: string;
  thumbnailUrl: string;
  userLogin: string;
}

export async function fetchLiveStream(clientId: string, clientSecret: string, userLogin: string): Promise<LiveStream | null> {
  const token = await getAppAccessToken(clientId, clientSecret);
  if (!token) return null;

  const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(userLogin)}`, {
    headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) return null;

  const data = (await res.json()) as {
    data: { id: string; title: string; game_name: string; thumbnail_url: string; user_login: string }[];
  };
  const stream = data.data[0];
  if (!stream) return null;

  return {
    streamId: stream.id,
    title: stream.title,
    gameName: stream.game_name,
    thumbnailUrl: stream.thumbnail_url.replace("{width}", "640").replace("{height}", "360"),
    userLogin: stream.user_login,
  };
}
