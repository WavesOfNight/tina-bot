import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, getBotConfig, setTwitchBotAccount, setTwitchBotApp, setTwitchBotSettings } from "@tina/database";
import { auth, type SessionRole } from "@/auth";
import { getBotGuilds } from "@/lib/discord";
import { getTwitchRedirectUri } from "@/lib/twitch";
import { TvMinimalPlay } from "lucide-react";

export const dynamic = "force-dynamic";

const TWITCH_SCOPES = "chat:read chat:edit channel:moderate moderator:manage:banned_users moderator:manage:chat_messages";

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
  revalidatePath("/dashboard/twitch");
}

async function saveAccount(formData: FormData) {
  "use server";
  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const channelName = (formData.get("channelName") as string)?.trim().toLowerCase();
  if (!username || !channelName) return;

  await setTwitchBotAccount(username, channelName);
  revalidatePath("/dashboard/twitch");
}

async function saveSettings(formData: FormData) {
  "use server";
  const linkedGuildId = (formData.get("linkedGuildId") as string) || null;
  const autoModLevel = (formData.get("autoModLevel") as string) || "OFF";
  const prefix = (formData.get("prefix") as string)?.trim() || "!";
  const enabled = formData.get("enabled") === "on";
  await setTwitchBotSettings({ linkedGuildId, autoModLevel, prefix, enabled });
  revalidatePath("/dashboard/twitch");
}

async function addCommand(formData: FormData) {
  "use server";
  const name = (formData.get("name") as string)?.trim().toLowerCase().replace(/\s+/g, "");
  const response = (formData.get("response") as string)?.trim();
  const cooldownSeconds = Math.max(0, Number(formData.get("cooldownSeconds")) || 5);
  if (!name || !response) return;

  await prisma.twitchCommand.upsert({
    where: { name },
    create: { name, response, cooldownSeconds },
    update: { response, cooldownSeconds },
  });
  revalidatePath("/dashboard/twitch");
}

async function deleteCommand(id: number) {
  "use server";
  await prisma.twitchCommand.delete({ where: { id } });
  revalidatePath("/dashboard/twitch");
}

export default async function TwitchPage({ searchParams }: { searchParams: { twitchConnected?: string; twitchError?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session as typeof session & { role?: SessionRole }).role ?? "owner";
  if (role !== "owner") redirect("/dashboard");

  const [rawConfig, commands, botConfig, guilds] = await Promise.all([
    prisma.twitchBotConfig.findUnique({ where: { id: 1 } }),
    prisma.twitchCommand.findMany({ orderBy: { name: "asc" } }),
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
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#9146FF] text-white shadow-glass">
            <TvMinimalPlay size={19} strokeWidth={2.25} aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-lavender-900">Bot Twitch</h1>
        </div>
        <a href="/dashboard" className="text-sm text-lavender-600 underline">
          Retour aux serveurs
        </a>
      </div>

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
            Si tu t&apos;etais deja connectee avant l&apos;ajout des permissions de moderation (timeout/ban/suppression),
            reclique sur &quot;Se reconnecter avec Twitch&quot; pour les accorder - l&apos;ancien token ne les a pas.
          </p>
        )}
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">4. Liaison et moderation</h2>
      <form action={saveSettings} className="glass-panel mb-4 space-y-3 rounded-aero p-5 shadow-glass">
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Moderation automatique</label>
            <select
              name="autoModLevel"
              defaultValue={rawConfig?.autoModLevel ?? "OFF"}
              className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
            >
              <option value="OFF">Desactivee</option>
              <option value="LOW">Faible (insultes graves)</option>
              <option value="MEDIUM">Moyenne (+ grossierete courante)</option>
              <option value="HIGH">Elevee (+ langage leger)</option>
            </select>
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
        </div>
        <label className="flex items-center gap-2 text-sm text-lavender-800">
          <input type="checkbox" name="enabled" defaultChecked={rawConfig?.enabled ?? false} className="h-4 w-4 rounded border-lavender-300" />
          Activer le bot Twitch
        </label>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer
        </button>
      </form>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">Commandes personnalisees ({commands.length})</h2>
      <form action={addCommand} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Nom (sans prefixe)</label>
          <input name="name" required placeholder="discord" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Reponse</label>
          <input
            name="response"
            required
            placeholder="Rejoins le Discord : {channel} !"
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Cooldown (s)</label>
          <input name="cooldownSeconds" type="number" min={0} defaultValue={5} className="w-20 rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-[#9146FF] px-5 py-2 text-sm font-medium text-white shadow-glass">
          Ajouter
        </button>
      </form>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {commands.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucune commande personnalisee pour le moment.</p>}
        {commands.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="font-medium text-lavender-900">
                {rawConfig?.prefix ?? "!"}
                {c.name}
              </p>
              <p className="text-sm text-lavender-600">{c.response}</p>
              <p className="text-xs text-lavender-400">
                {c.uses} utilisation{c.uses > 1 ? "s" : ""} - cooldown {c.cooldownSeconds}s
              </p>
            </div>
            <form action={deleteCommand.bind(null, c.id)}>
              <button type="submit" className="rounded-full bg-coral-100 px-3 py-1 text-xs font-medium text-coral-600">
                Supprimer
              </button>
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}
