const HELIX_BASE = "https://api.twitch.tv/helix";

export interface HelixContext {
  clientId: string;
  accessToken: string;
}

async function helixFetch(ctx: HelixContext, path: string, init: RequestInit = {}): Promise<Response | null> {
  const res = await fetch(`${HELIX_BASE}${path}`, {
    ...init,
    headers: {
      "Client-Id": ctx.clientId,
      Authorization: `Bearer ${ctx.accessToken}`,
      ...(init.headers ?? {}),
    },
  }).catch(() => null);

  if (!res || !res.ok) {
    const responseBody = await res?.text().catch(() => "");
    console.error(
      `Echec requete Helix ${init.method ?? "GET"} ${path} (status ${res?.status ?? "?"})`,
      `body envoye: ${init.body ?? "(aucun)"}`,
      `reponse Twitch: ${responseBody}`,
    );
  }

  return res;
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
  return Boolean(res?.ok);
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
  return Boolean(res?.ok);
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
  return Boolean(res?.ok);
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
  return Boolean(res?.ok);
}
