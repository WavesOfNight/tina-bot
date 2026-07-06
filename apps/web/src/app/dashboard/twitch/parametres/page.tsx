import { revalidatePath } from "next/cache";
import { prisma, getBotConfig, setTwitchBotAccount, setTwitchBotApp, setTwitchBotSettings, setTwitchEngagement } from "@tina/database";
import { getBotGuilds } from "@/lib/discord";
import { getTwitchRedirectUri } from "@/lib/twitch";
import { PageHeader } from "@/components/PageHeader";
import { Settings } from "lucide-react";

export const dynamic = "force-dynamic";

const TWITCH_SCOPES =
  "chat:read chat:edit channel:moderate moderator:manage:banned_users moderator:manage:chat_messages moderator:manage:warnings moderator:manage:shoutouts moderator:read:followers moderator:read:chatters channel:read:subscriptions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Twitch n'a pas renvoye de code d'autorisation. Reessaie.",
  missing_app_credentials: "Enregistre d'abord le Client ID et Client Secret ci-dessous avant de te connecter.",
  token_exchange_failed: "Twitch a refuse l'echange du code (verifie le Client ID/Secret et l'URL de redirection enregistree).",
};

async function saveApp(formData: FormData) {
  "use server";
  const clientId = (formData.get("clientId") as string)?.trim();
  const clientSecret = (formData.get("clientSecret") as string)?.trim();
  if (!clientId) return;

  const existing = await prisma.twitchBotConfig.findUnique({ where: { id: 1 } });
  const secretToUse = clientSecret || null;
  if (!secretToUse && !existing?.clientSecretEncrypted) return;

  if (secretToUse) {
    await setTwitchBotApp(clientId, secretToUse);
  } else {
    await prisma.twitchBotConfig.upsert({ where: { id: 1 }, create: { id: 1, clientId }, update: { clientId } });
  }
  revalidatePath("/dashboard/twitch/parametres");
}

async function saveAccount(formData: FormData) {
  "use server";
  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const channelName = (formData.get("channelName") as string)?.trim().toLowerCase();
  if (!username || !channelName) return;

  await setTwitchBotAccount(username, channelName);
  revalidatePath("/dashboard/twitch/parametres");
}

async function saveLiaison(formData: FormData) {
  "use server";
  const linkedGuildId = (formData.get("linkedGuildId") as string) || null;
  const prefix = (formData.get("prefix") as string)?.trim() || "!";
  const enabled = formData.get("enabled") === "on";
  await setTwitchBotSettings({ linkedGuildId, prefix, enabled });
  revalidatePath("/dashboard/twitch/parametres");
  revalidatePath("/dashboard/twitch");
}

async function saveEngagement(formData: FormData) {
  "use server";
  await setTwitchEngagement({
    raidShoutoutEnabled: formData.get("raidShoutoutEnabled") === "on",
    announceFollows: formData.get("announceFollows") === "on",
    announceSubs: formData.get("announceSubs") === "on",
  });
  revalidatePath("/dashboard/twitch/parametres");
}

export default async function TwitchParametresPage({
  searchParams,
}: {
  searchParams: { twitchConnected?: string; twitchError?: string };
}) {
  const [rawConfig, botConfig, guilds] = await Promise.all([
    prisma.twitchBotConfig.findUnique({ where: { id: 1 } }),
    getBotConfig(),
    getBotGuilds(),
  ]);

  const linkedGuild = rawConfig?.linkedGuildId ? await prisma.guild.findUnique({ where: { id: rawConfig.linkedGuildId } }) : null;
  const hasApp = Boolean(rawConfig?.clientId && rawConfig?.clientSecretEncrypted);
  const hasAccount = Boolean(rawConfig?.username && rawConfig?.channelName);
  const isConnected = Boolean(rawConfig?.accessTokenEncrypted && rawConfig?.refreshTokenEncrypted);
  const redirectUri = getTwitchRedirectUri();

  const authorizeUrl =
    hasApp && rawConfig?.clientId
      ? `https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(rawConfig.clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(TWITCH_SCOPES)}&force_verify=true`
      : null;

  return (
    <div>
      <PageHeader icon={Settings} title="Parametres" subtitle="Application Twitch, compte du bot, connexion et liaison Discord" />

      {searchParams.twitchConnected && (
        <div className="mb-4 rounded-xl bg-aqua-100 px-4 py-3 text-sm text-aqua-800">Connexion Twitch reussie ! Le token se rafraichit automatiquement.</div>
      )}
      {searchParams.twitchError && (
        <div className="mb-4 rounded-xl bg-coral-100 px-4 py-3 text-sm text-coral-600">
          {ERROR_MESSAGES[searchParams.twitchError] ?? `Erreur Twitch : ${searchParams.twitchError}`}
        </div>
      )}

      <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <div className="mb-3 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${rawConfig?.enabled && hasAccount && isConnected ? "bg-aqua-400" : "bg-lavender-200"}`} />
          <p className="text-sm text-lavender-800">
            {rawConfig?.enabled && hasAccount && isConnected
              ? "Activee et connectee - le token se rafraichit automatiquement"
              : isConnected
                ? "Connectee mais desactivee (coche la case plus bas)"
                : "Pas encore connectee a Twitch"}
          </p>
        </div>
        <p className="text-xs text-lavender-500">
          Tina rejoint le chat Twitch avec un compte de bot (peut etre ton propre compte ou un compte dedie). Ce compte doit
          etre modérateur du salon pour pouvoir supprimer des messages et faire des timeouts (tape{" "}
          <code>/mod nomdubot</code> dans ton chat Twitch).
        </p>
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">1. Application Twitch</h2>
      <p className="mb-3 text-xs text-lavender-500">
        Cree une application sur{" "}
        <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noreferrer" className="underline">
          dev.twitch.tv/console/apps
        </a>{" "}
        (categorie &quot;Chat Bot&quot;), puis ajoute cette URL exacte dans ses &quot;OAuth Redirect URLs&quot; :
      </p>
      <p className="mb-3 break-all rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 font-mono text-xs text-lavender-800">
        {redirectUri}
      </p>
      <form action={saveApp} className="glass-panel mb-4 space-y-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Client ID</label>
          <input
            name="clientId"
            required
            defaultValue={rawConfig?.clientId ?? ""}
            placeholder="abc123..."
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Client Secret</label>
          <input
            name="clientSecret"
            type="password"
            placeholder={hasApp ? "Laisse vide pour garder le secret actuel" : "colle le secret ici"}
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-[#9146FF] px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer l&apos;application
        </button>
      </form>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">2. Compte du bot</h2>
      <form action={saveAccount} className="glass-panel mb-4 space-y-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Nom d&apos;utilisateur du bot</label>
          <input
            name="username"
            required
            defaultValue={rawConfig?.username ?? ""}
            placeholder="tina_bot"
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Salon a rejoindre (ton pseudo Twitch)</label>
          <input
            name="channelName"
            required
            defaultValue={rawConfig?.channelName ?? ""}
            placeholder="liratsu"
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer le compte
        </button>
      </form>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">3. Connexion</h2>
      <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        {isConnected && rawConfig?.tokenExpiresAt && (
          <p className="mb-3 text-xs text-lavender-500">
            Token actuel valide jusqu&apos;a {new Date(rawConfig.tokenExpiresAt).toLocaleString("fr-FR")} (renouvele
            automatiquement avant expiration).
          </p>
        )}
        {authorizeUrl ? (
          <a
            href={authorizeUrl}
            className="bubble-btn inline-block rounded-full bg-[#9146FF] px-5 py-2 text-sm font-medium text-white shadow-glass"
          >
            {isConnected ? "Se reconnecter avec Twitch" : "Se connecter avec Twitch"}
          </a>
        ) : (
          <p className="text-sm text-coral-500">Enregistre d&apos;abord le Client ID / Client Secret ci-dessus.</p>
        )}
        {isConnected && (
          <p className="mt-3 text-xs text-coral-500">
            Si tu t&apos;etais deja connectee avant l&apos;ajout de nouvelles permissions, reclique sur &quot;Se reconnecter
            avec Twitch&quot; pour les accorder - l&apos;ancien token ne les a pas.
          </p>
        )}
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">4. Liaison Discord</h2>
      <form action={saveLiaison} className="glass-panel mb-4 space-y-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Serveur Discord lie (pour les logs)</label>
          <select
            name="linkedGuildId"
            defaultValue={rawConfig?.linkedGuildId ?? ""}
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          >
            <option value="">Aucun (pas de logs)</option>
            {guilds.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {rawConfig?.linkedGuildId && (
            <p className="mt-1 text-xs text-lavender-500">
              {linkedGuild?.modLogChannelId
                ? "Les actions de moderation Twitch seront envoyees dans le salon de logs configure sur ce serveur."
                : "Ce serveur n'a pas de salon de logs configure (page Moderation) : les evenements Twitch ne seront pas relayes sur Discord tant que ce n'est pas fait."}
            </p>
          )}
          {!botConfig && <p className="mt-1 text-xs text-coral-500">Configure d'abord le bot Discord dans Parametres pour pouvoir choisir un serveur.</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Prefixe des commandes</label>
          <input
            name="prefix"
            defaultValue={rawConfig?.prefix ?? "!"}
            maxLength={3}
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-lavender-800">
          <input type="checkbox" name="enabled" defaultChecked={rawConfig?.enabled ?? false} className="h-4 w-4 rounded border-lavender-300" />
          Activer le bot Twitch
        </label>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer
        </button>
      </form>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">5. Engagement</h2>
      <form action={saveEngagement} className="glass-panel mb-4 space-y-2 rounded-aero p-5 shadow-glass">
        <label className="flex items-center gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
          <input type="checkbox" name="raidShoutoutEnabled" defaultChecked={rawConfig?.raidShoutoutEnabled ?? true} className="h-4 w-4 rounded border-lavender-300" />
          Shoutout automatique quand quelqu&apos;un raid la chaine
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
          <input type="checkbox" name="announceFollows" defaultChecked={rawConfig?.announceFollows ?? false} className="h-4 w-4 rounded border-lavender-300" />
          Annoncer les nouveaux follows dans le chat
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-lavender-200 bg-white/60 p-3 text-sm">
          <input type="checkbox" name="announceSubs" defaultChecked={rawConfig?.announceSubs ?? false} className="h-4 w-4 rounded border-lavender-300" />
          Annoncer les nouveaux abonnements dans le chat
        </label>
        <p className="pt-1 text-xs text-lavender-500">
          Les abonnements necessitent que le compte connecte soit le broadcaster lui-meme (Twitch ne permet pas toujours
          cette lecture a un simple moderateur) - si ca ne fonctionne pas, c&apos;est une limitation cote Twitch, pas un bug.
        </p>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer
        </button>
      </form>
    </div>
  );
}
