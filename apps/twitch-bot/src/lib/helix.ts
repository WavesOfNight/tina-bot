const HELIX_BASE = "https://api.twitch.tv/helix";

export interface HelixContext {
  clientId: string;
  accessToken: string;
}

async function helixFetch(ctx: HelixContext, path: string, init: RequestInit = {}): Promise<Response | null> {
  return fetch(`${HELIX_BASE}${path}`, {
    ...init,
    headers: {
      "Client-Id": ctx.clientId,
      Authorization: `Bearer ${ctx.accessToken}`,
      ...(init.headers ?? {}),
    },
  }).catch(() => null);
}

export async function getAuthenticatedUserId(ctx: HelixContext): Promise<string | null> {
  const res = await helixFetch(ctx, "/users");
  if (!res || !res.ok) return null;
  const data = (await res.json()) as { data: { id: string }[] };
  return data.data[0]?.id ?? null;
}

export async function getUserId(ctx: HelixContext, login: string): Promise<string | null> {
  const res = await helixFetch(ctx, `/users?login=${encodeURIComponent(login)}`);
  if (!res || !res.ok) return null;
  const data = (await res.json()) as { data: { id: string }[] };
  return data.data[0]?.id ?? null;
}

export async function deleteChatMessage(
  ctx: HelixContext,
  broadcasterId: string,
  moderatorId: string,
  messageId: string,
): Promise<boolean> {
  const res = await helixFetch(
    ctx,
    `/moderation/chat?broadcaster_id=${broadcasterId}&moderator_id=${moderatorId}&message_id=${messageId}`,
    { method: "DELETE" },
  );
  if (!res || !res.ok) {
    console.error(`Echec suppression Helix (status ${res?.status ?? "?"})`, await res?.text().catch(() => ""));
    return false;
  }
  return true;
}

export async function banUser(
  ctx: HelixContext,
  broadcasterId: string,
  moderatorId: string,
  userId: string,
  reason: string,
  durationSeconds?: number,
): Promise<boolean> {
  const res = await helixFetch(ctx, `/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${moderatorId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: { user_id: userId, reason: reason.slice(0, 500), ...(durationSeconds ? { duration: durationSeconds } : {}) },
    }),
  });
  if (!res || !res.ok) {
    console.error(`Echec ban/timeout Helix (status ${res?.status ?? "?"})`, await res?.text().catch(() => ""));
    return false;
  }
  return true;
}

export async function sendWarning(
  ctx: HelixContext,
  broadcasterId: string,
  moderatorId: string,
  userId: string,
  reason: string,
): Promise<boolean> {
  const res = await helixFetch(ctx, `/moderation/warnings?broadcaster_id=${broadcasterId}&moderator_id=${moderatorId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [{ user_id: userId, reason: reason.slice(0, 500) }] }),
  });
  if (!res || !res.ok) {
    console.error(`Echec avertissement officiel Helix (status ${res?.status ?? "?"})`, await res?.text().catch(() => ""));
    return false;
  }
  return true;
}

export async function sendShoutout(
  ctx: HelixContext,
  broadcasterId: string,
  moderatorId: string,
  targetBroadcasterId: string,
): Promise<boolean> {
  const res = await helixFetch(
    ctx,
    `/chat/shoutouts?from_broadcaster_id=${broadcasterId}&to_broadcaster_id=${targetBroadcasterId}&moderator_id=${moderatorId}`,
    { method: "POST" },
  );
  if (!res || !res.ok) {
    console.error(`Echec shoutout Helix (status ${res?.status ?? "?"})`, await res?.text().catch(() => ""));
    return false;
  }
  return true;
}
