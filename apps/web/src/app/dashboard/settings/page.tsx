import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { changeAdminPassword, getBotConfig, prisma, setBotConfig, setTwitchConfig } from "@tina/database";
import { auth, type SessionRole } from "@/auth";
import { checkBotConnection } from "@/lib/discord";

export const dynamic = "force-dynamic";

async function changePassword(username: string, formData: FormData) {
  "use server";
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
    redirect("/dashboard/settings?pwError=invalid");
  }

  const success = await changeAdminPassword(username, currentPassword, newPassword);
  redirect(success ? "/dashboard/settings?pwSuccess=1" : "/dashboard/settings?pwError=wrong");
}

async function saveBotConfig(formData: FormData) {
  "use server";
  const clientId = (formData.get("clientId") as string)?.trim();
  const token = (formData.get("token") as string)?.trim();
  const clientSecret = (formData.get("clientSecret") as string)?.trim();
  if (!clientId) return;

  const existing = await getBotConfig();
  const tokenToUse = token || existing?.token;
  if (!tokenToUse) return;
  const clientSecretToUse = clientSecret || existing?.clientSecret || null;

  await setBotConfig(clientId, tokenToUse, clientSecretToUse);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/login");
}

async function saveTwitchConfig(formData: FormData) {
  "use server";
  const twitchClientId = (formData.get("twitchClientId") as string)?.trim();
  const twitchClientSecret = (formData.get("twitchClientSecret") as string)?.trim();
  if (!twitchClientId || !twitchClientSecret) return;

  await setTwitchConfig(twitchClientId, twitchClientSecret);
  revalidatePath("/dashboard/settings");
}

async function addActivity(formData: FormData) {
  "use server";
  const type = (formData.get("type") as string) || "WATCHING";
  const text = (formData.get("text") as string)?.trim();
  const durationSeconds = Number(formData.get("durationSeconds") || 30);
  if (!text) return;

  const maxOrder = await prisma.botActivity.aggregate({ _max: { order: true } });
  await prisma.botActivity.create({
    data: { type, text, durationSeconds, order: (maxOrder._max.order ?? -1) + 1 },
  });
  revalidatePath("/dashboard/settings");
}

async function toggleActivity(id: number, enabled: boolean) {
  "use server";
  await prisma.botActivity.update({ where: { id }, data: { enabled } });
  revalidatePath("/dashboard/settings");
}

async function deleteActivity(id: number) {
  "use server";
  await prisma.botActivity.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  PLAYING: "Joue a",
  WATCHING: "Regarde/Surveille",
  LISTENING: "Ecoute",
  COMPETING: "Participe a",
};

export default async function SettingsPage({ searchParams }: { searchParams: { pwError?: string; pwSuccess?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session as typeof session & { role?: SessionRole }).role ?? "owner";
  if (role !== "owner") redirect("/dashboard");

  const changePasswordAction = changePassword.bind(null, session.user?.name ?? "");

  const [config, connection, activities] = await Promise.all([
    getBotConfig(),
    checkBotConnection(),
    prisma.botActivity.findMany({ orderBy: { order: "asc" } }),
  ]);

  const inviteUrl = config
    ? `https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&scope=bot%20applications.commands&permissions=1099511627775`
    : null;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-lavender-900">Parametres du bot</h1>
        <a href="/dashboard" className="text-sm text-lavender-600 underline">
          Retour aux serveurs
        </a>
      </div>

      <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold text-lavender-900">
        <span aria-hidden="true">🔐</span> Compte admin
      </h2>
      {searchParams.pwSuccess && (
        <p className="mb-3 rounded-xl bg-aqua-100 px-4 py-2 text-sm text-aqua-800">Mot de passe change avec succes.</p>
      )}
      {searchParams.pwError === "invalid" && (
        <p className="mb-3 rounded-xl bg-coral-100 px-4 py-2 text-sm text-coral-600">
          Le nouveau mot de passe doit faire au moins 8 caracteres et etre identique dans les deux champs.
        </p>
      )}
      {searchParams.pwError === "wrong" && (
        <p className="mb-3 rounded-xl bg-coral-100 px-4 py-2 text-sm text-coral-600">Mot de passe actuel incorrect.</p>
      )}
      <form action={changePasswordAction} className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <p className="mb-3 text-xs text-lavender-500">
          Connecte en tant que <span className="font-medium text-lavender-800">{session.user?.name}</span>.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Mot de passe actuel</label>
            <input name="currentPassword" type="password" required className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Nouveau mot de passe</label>
            <input name="newPassword" type="password" required minLength={8} className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Confirmer</label>
            <input name="confirmPassword" type="password" required minLength={8} className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
        </div>
        <button type="submit" className="bubble-btn mt-3 rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Changer le mot de passe
        </button>
      </form>

      <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <p className="mb-1 text-sm font-medium text-lavender-800">Statut du token</p>
        {connection.connected ? (
          <p className="flex items-center gap-2 text-sm text-aqua-600">
            <span className="h-2 w-2 rounded-full bg-aqua-400" /> Token valide ({connection.tag}) - verifie sur Discord que le bot apparait bien en ligne
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-coral-600">
            <span className="h-2 w-2 rounded-full bg-coral-400" /> Token invalide ou absent
          </p>
        )}
      </div>

      <form action={saveBotConfig} className="glass-panel rounded-aero p-6 shadow-glass">
        <label className="mb-1 block text-xs text-lavender-600">Application (Client) ID</label>
        <input
          name="clientId"
          defaultValue={config?.clientId ?? ""}
          required
          placeholder="123456789012345678"
          className="mb-4 w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-lavender-600">Token du bot</label>
        <input
          name="token"
          type="password"
          required={!config}
          placeholder={config ? "Laisse vide pour garder le token actuel" : "Colle le token depuis le Developer Portal"}
          className="mb-1 w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
        />
        <p className="mb-4 text-xs text-lavender-500">
          Trouve ces informations sur{" "}
          <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="underline">
            discord.com/developers/applications
          </a>{" "}
          (Bot &gt; Reset Token, et General Information &gt; Application ID). Le token est chiffre avant d&apos;etre stocke.
        </p>

        <label className="mb-1 block text-xs text-lavender-600">Client Secret (optionnel)</label>
        <input
          name="clientSecret"
          type="password"
          placeholder={config?.clientSecret ? "Laisse vide pour garder le secret actuel" : "Colle le Client Secret depuis OAuth2"}
          className="mb-1 w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
        />
        <p className="mb-4 text-xs text-lavender-500">
          Permet aux admins de tes serveurs de se connecter avec leur propre compte Discord (comme MEE6) pour gerer
          uniquement leur serveur. Trouve-le dans l&apos;onglet OAuth2 de ton application Discord. Ajoute aussi{" "}
          <code className="rounded bg-lavender-100 px-1">{process.env.NEXTAUTH_URL}/api/auth/callback/discord</code>{" "}
          comme Redirect URI la-bas.
        </p>

        <button type="submit" className="bubble-btn rounded-full bg-blush-400 px-6 py-2.5 text-sm font-medium text-white shadow-glass">
          Enregistrer
        </button>
      </form>

      {inviteUrl && (
        <div className="glass-panel mt-4 rounded-aero p-5 shadow-glass">
          <p className="mb-2 text-sm font-medium text-lavender-800">Inviter Tina [BOT] sur un serveur</p>
          <a href={inviteUrl} target="_blank" rel="noreferrer" className="text-sm text-blush-400 underline">
            Generer le lien d&apos;invitation
          </a>
        </div>
      )}

      <h2 className="font-display mb-3 mt-8 flex items-center gap-2 text-lg font-semibold text-lavender-900">
        <span aria-hidden="true">🟣</span> Alertes Twitch
      </h2>
      <p className="mb-3 text-xs text-lavender-500">
        Necessaire uniquement pour les alertes Twitch (YouTube ne demande rien). Cree une application gratuite sur{" "}
        <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noreferrer" className="underline">
          dev.twitch.tv/console/apps
        </a>{" "}
        et colle son Client ID et Client Secret ici.
      </p>
      <form action={saveTwitchConfig} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Twitch Client ID</label>
          <input name="twitchClientId" defaultValue={config?.twitchClientId ?? ""} placeholder="abc123..." className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Twitch Client Secret</label>
          <input
            name="twitchClientSecret"
            type="password"
            placeholder={config?.twitchClientSecret ? "Laisse vide pour garder le secret actuel" : "colle le secret ici"}
            className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-[#9146FF] px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer
        </button>
      </form>

      <h2 className="font-display mb-3 mt-8 flex items-center gap-2 text-lg font-semibold text-lavender-900">
        <span aria-hidden="true">🎬</span> Activite du bot ({activities.length})
      </h2>
      <p className="mb-3 text-xs text-lavender-500">
        Le bot fait defiler ces statuts les uns apres les autres, chacun pendant la duree indiquee. Variables : {"{randomMember}"}
        {" "}(membre au hasard), {"{memberCount}"} (nombre de membres), {"{serverCount}"} (nombre de serveurs).
      </p>

      <form action={addActivity} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Type</label>
          <select name="type" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="WATCHING">Regarde/Surveille</option>
            <option value="PLAYING">Joue a</option>
            <option value="LISTENING">Ecoute</option>
            <option value="COMPETING">Participe a</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Texte</label>
          <input
            name="text"
            required
            placeholder="{randomMember} | /help pour voir les commandes"
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Duree (secondes)</label>
          <input type="number" name="durationSeconds" defaultValue={30} min={5} className="w-24 rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Ajouter
        </button>
      </form>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {activities.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucune activite configuree, le bot affiche le statut par defaut.</p>}
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="font-medium text-lavender-900">
                {ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type} {activity.text}
              </p>
              <p className="text-xs text-lavender-600">{activity.durationSeconds}s</p>
            </div>
            <div className="flex items-center gap-2">
              <form action={toggleActivity.bind(null, activity.id, !activity.enabled)}>
                <button
                  type="submit"
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    activity.enabled ? "bg-aqua-200 text-aqua-800" : "bg-lavender-100 text-lavender-500"
                  }`}
                >
                  {activity.enabled ? "Active" : "Desactive"}
                </button>
              </form>
              <form action={deleteActivity.bind(null, activity.id)}>
                <button type="submit" className="rounded-full bg-coral-100 px-3 py-1 text-xs font-medium text-coral-600">
                  Supprimer
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
