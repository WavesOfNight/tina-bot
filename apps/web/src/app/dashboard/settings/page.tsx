import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getBotConfig, setBotConfig } from "@tina/database";
import { auth } from "@/auth";
import { checkBotConnection } from "@/lib/discord";

export const dynamic = "force-dynamic";

async function saveBotConfig(formData: FormData) {
  "use server";
  const clientId = (formData.get("clientId") as string)?.trim();
  const token = (formData.get("token") as string)?.trim();
  if (!clientId) return;

  const existing = await getBotConfig();
  const tokenToUse = token || existing?.token;
  if (!tokenToUse) return;

  await setBotConfig(clientId, tokenToUse);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [config, connection] = await Promise.all([getBotConfig(), checkBotConnection()]);

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

      <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <p className="mb-1 text-sm font-medium text-lavender-800">Statut de connexion</p>
        {connection.connected ? (
          <p className="flex items-center gap-2 text-sm text-aqua-600">
            <span className="h-2 w-2 rounded-full bg-aqua-400" /> Connectee en tant que {connection.tag}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-coral-600">
            <span className="h-2 w-2 rounded-full bg-coral-400" /> Deconnectee
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
    </main>
  );
}
