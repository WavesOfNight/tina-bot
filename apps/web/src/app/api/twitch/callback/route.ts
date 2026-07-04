import { NextRequest, NextResponse } from "next/server";
import { getTwitchBotAppCredentials, saveTwitchBotOAuthTokens } from "@tina/database";
import { getTwitchRedirectUri } from "@/lib/twitch";

export async function GET(request: NextRequest) {
  console.log(`[twitch-callback] requete recue : ${request.nextUrl.toString()}`);

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const redirectTarget = new URL("/dashboard/twitch", process.env.NEXTAUTH_URL || request.url);

  if (error) {
    console.error(`[twitch-callback] Twitch a renvoye une erreur : ${error}`);
    redirectTarget.searchParams.set("twitchError", error);
    return NextResponse.redirect(redirectTarget);
  }
  if (!code) {
    console.error("[twitch-callback] Aucun parametre 'code' dans la requete");
    redirectTarget.searchParams.set("twitchError", "missing_code");
    return NextResponse.redirect(redirectTarget);
  }

  const app = await getTwitchBotAppCredentials();
  if (!app) {
    console.error("[twitch-callback] Client ID/Secret non trouves en base");
    redirectTarget.searchParams.set("twitchError", "missing_app_credentials");
    return NextResponse.redirect(redirectTarget);
  }

  const redirectUri = getTwitchRedirectUri();
  console.log(`[twitch-callback] Echange du code aupres de Twitch (redirect_uri=${redirectUri})`);

  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  }).catch((fetchError) => {
    console.error("[twitch-callback] Le fetch vers id.twitch.tv a leve une exception", fetchError);
    return null;
  });

  if (!tokenRes || !tokenRes.ok) {
    const body = await tokenRes?.text().catch(() => "");
    console.error(`[twitch-callback] Echec de l'echange de token (status ${tokenRes?.status ?? "?"}) : ${body}`);
    redirectTarget.searchParams.set("twitchError", "token_exchange_failed");
    return NextResponse.redirect(redirectTarget);
  }

  const data = (await tokenRes.json()) as { access_token: string; refresh_token: string; expires_in: number };
  console.log(`[twitch-callback] Token obtenu avec succes, expire dans ${data.expires_in}s. Enregistrement en base...`);
  await saveTwitchBotOAuthTokens(data.access_token, data.refresh_token, data.expires_in);
  console.log("[twitch-callback] Token enregistre avec succes.");

  redirectTarget.searchParams.set("twitchConnected", "1");
  return NextResponse.redirect(redirectTarget);
}
