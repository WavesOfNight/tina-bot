import { NextRequest, NextResponse } from "next/server";
import { getTwitchBotAppCredentials, saveTwitchBotOAuthTokens } from "@tina/database";
import { getTwitchRedirectUri } from "@/lib/twitch";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const redirectTarget = new URL("/dashboard/twitch", process.env.NEXTAUTH_URL || request.url);

  if (error) {
    redirectTarget.searchParams.set("twitchError", error);
    return NextResponse.redirect(redirectTarget);
  }
  if (!code) {
    redirectTarget.searchParams.set("twitchError", "missing_code");
    return NextResponse.redirect(redirectTarget);
  }

  const app = await getTwitchBotAppCredentials();
  if (!app) {
    redirectTarget.searchParams.set("twitchError", "missing_app_credentials");
    return NextResponse.redirect(redirectTarget);
  }

  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getTwitchRedirectUri(),
    }),
  }).catch(() => null);

  if (!tokenRes || !tokenRes.ok) {
    redirectTarget.searchParams.set("twitchError", "token_exchange_failed");
    return NextResponse.redirect(redirectTarget);
  }

  const data = (await tokenRes.json()) as { access_token: string; refresh_token: string; expires_in: number };
  await saveTwitchBotOAuthTokens(data.access_token, data.refresh_token, data.expires_in);

  redirectTarget.searchParams.set("twitchConnected", "1");
  return NextResponse.redirect(redirectTarget);
}
