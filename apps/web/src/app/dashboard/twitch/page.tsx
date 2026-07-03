import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, getBotConfig, setTwitchBotAccount, setTwitchBotSettings } from "@tina/database";
import { auth, type SessionRole } from "@/auth";
import { getBotGuilds } from "@/lib/discord";
import { TvMinimalPlay } from "lucide-react";

export const dynamic = "force-dynamic";

async function saveAccount(formData: FormData) {
  "use server";
  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const oauthToken = (formData.get("oauthToken") as string)?.trim();
  const channelName = (formData.get("channelName") as string)?.trim().toLowerCase();
  if (!username || !channelName) return;

  const existing = await prisma.twitchBotConfig.findUnique({ where: { id: 1 } });
  const tokenToUse = oauthToken || null;
  if (!tokenToUse && !existing?.oauthTokenEncrypted) return;

  if (tokenToUse) {
    await setTwitchBotAccount(username, tokenToUse, channelName);
  } else {
    await prisma.twitchBotConfig.upsert({
      where: { id: 1 },
      create: { id: 1, username, channelName },
      update: { username, channelName },
    });
  }
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

export default async function TwitchPage() {
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
  const hasAccount = Boolean(rawConfig?.username && rawConfig?.oauthTokenEncrypted && rawConfig?.channelName);

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

      <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <div className="mb-3 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${rawConfig?.enabled && hasAccount ? "bg-aqua-400" : "bg-lavender-200"}`} />
          <p className="text-sm text-lavender-800">
            {rawConfig?.enabled && hasAccount ? "Activee - se connecte automatiquement" : "Desactivee ou compte incomplet"}
          </p>
        </div>
        <p className="text-xs text-lavender-500">
          Tina rejoint le chat Twitch avec un compte de bot (peut etre ton propre compte ou un compte dedie). Ce compte doit
          etre modérateur du salon pour pouvoir supprimer des messages et faire des timeouts.
        </p>
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">Compte Twitch</h2>
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
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Token OAuth</label>
          <input
            name="oauthToken"
            type="password"
            placeholder={hasAccount ? "Laisse vide pour garder le token actuel" : "oauth:xxxxxxxxxxxxxxxxxxxxx"}
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-lavender-500">
            Genere-le gratuitement sur{" "}
            <a href="https://twitchtokengenerator.com" target="_blank" rel="noreferrer" className="underline">
              twitchtokengenerator.com
            </a>{" "}
            (scopes <code>chat:read</code> et <code>chat:edit</code>) en etant connecte avec le compte du bot. Le token est
            chiffre avant d&apos;etre stocke.
          </p>
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-[#9146FF] px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer le compte
        </button>
      </form>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">Liaison et moderation</h2>
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
