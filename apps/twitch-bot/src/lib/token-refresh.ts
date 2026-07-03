import { saveTwitchBotOAuthTokens } from "@tina/database";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export async function ensureFreshToken(config: {
  clientId: string | null;
  clientSecret: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string | null> {
  if (!config.accessToken) return null;

  const needsRefresh = !config.tokenExpiresAt || config.tokenExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;
  if (!needsRefresh) return config.accessToken;

  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    console.error(
      "Le token Twitch approche de son expiration mais le Client ID/Secret ou le refresh token est manquant. Reconnecte-toi via le panel.",
    );
    return config.accessToken;
  }

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
  }).catch(() => null);

  if (!res || !res.ok) {
    console.error("Echec du rafraichissement du token Twitch, nouvelle tentative au prochain cycle.");
    return config.accessToken;
  }

  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  await saveTwitchBotOAuthTokens(data.access_token, data.refresh_token, data.expires_in);
  console.log("Token Twitch rafraichi avec succes.");

  return data.access_token;
}
