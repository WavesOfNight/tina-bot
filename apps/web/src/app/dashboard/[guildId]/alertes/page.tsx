import { revalidatePath } from "next/cache";
import { getBotConfig, prisma } from "@tina/database";
import { getGuildChannels } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { Bell } from "lucide-react";

export const dynamic = "force-dynamic";

async function addAlert(guildId: string, formData: FormData) {
  "use server";
  const platform = (formData.get("platform") as string) === "TWITCH" ? "TWITCH" : "YOUTUBE";
  const channelRef = (formData.get("channelRef") as string)?.trim();
  const discordChannelId = formData.get("discordChannelId") as string;
  const message = (formData.get("message") as string)?.trim() || "{channel} vient de publier du nouveau contenu ! {url}";
  if (!channelRef || !discordChannelId) return;

  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.socialAlert.upsert({
    where: { guildId_platform_channelRef: { guildId, platform, channelRef } },
    create: { guildId, platform, channelRef, discordChannelId, message },
    update: { discordChannelId, message },
  });
  revalidatePath(`/dashboard/${guildId}/alertes`);
}

async function deleteAlert(guildId: string, id: number) {
  "use server";
  await prisma.socialAlert.delete({ where: { id } });
  revalidatePath(`/dashboard/${guildId}/alertes`);
}

async function saveStatsChannel(guildId: string, formData: FormData) {
  "use server";
  const statsChannelId = (formData.get("statsChannelId") as string) || null;
  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, statsChannelId },
    update: { statsChannelId },
  });
  revalidatePath(`/dashboard/${guildId}/alertes`);
}

export default async function AlertesPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [alerts, channels, voiceChannels, guild, botConfig] = await Promise.all([
    prisma.socialAlert.findMany({ where: { guildId }, orderBy: { createdAt: "desc" } }),
    getGuildChannels(guildId),
    getGuildChannels(guildId, 2),
    prisma.guild.findUnique({ where: { id: guildId } }),
    getBotConfig(),
  ]);

  const twitchAvailable = Boolean(botConfig?.twitchClientId && botConfig.twitchClientSecret);
  const add = addAlert.bind(null, guildId);
  const saveStats = saveStatsChannel.bind(null, guildId);

  return (
    <div>
      <PageHeader icon={Bell} title="Alertes" subtitle="YouTube, Twitch et salon de statistiques" />

      <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <h2 className="mb-2 text-sm font-medium text-lavender-800">Salon vocal statistiques</h2>
        <p className="mb-3 text-xs text-lavender-500">
          Affiche le nombre de membres en direct dans le nom d&apos;un salon vocal (mis a jour toutes les 10 minutes).
        </p>
        <form action={saveStats} className="flex flex-wrap items-end gap-3">
          <select name="statsChannelId" defaultValue={guild?.statsChannelId ?? ""} className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="">Desactive</option>
            {voiceChannels.map((c) => (
              <option key={c.id} value={c.id}>
                🔊 {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
            Enregistrer
          </button>
        </form>
      </div>

      <h2 className="font-display mb-3 mt-6 text-lg font-semibold text-lavender-900">YouTube et Twitch</h2>
      <p className="mb-3 text-xs text-lavender-500">
        YouTube fonctionne directement, aucune cle requise. Twitch necessite un Client ID/Secret configure dans{" "}
        <a href="/dashboard/settings" className="underline">
          Parametres
        </a>{" "}
        {twitchAvailable ? "(configure ✅)" : "(non configure ⚠️)"} .
      </p>

      <form action={add} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Plateforme</label>
          <select name="platform" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="YOUTUBE">YouTube</option>
            <option value="TWITCH">Twitch</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">ID de chaine YouTube / pseudo Twitch</label>
          <input name="channelRef" required placeholder="UCxxxxxxx ou pseudo_twitch" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Salon Discord</label>
          <select name="discordChannelId" required className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                # {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Message</label>
          <input name="message" placeholder="{channel} vient de publier du nouveau contenu ! {url}" className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-aqua-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Ajouter
        </button>
      </form>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {alerts.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucune alerte configuree.</p>}
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="font-medium text-lavender-900">
                {a.platform === "YOUTUBE" ? "▶️ YouTube" : "🟣 Twitch"} - {a.channelRef}
              </p>
              <p className="text-sm text-lavender-600">→ {"#"}{channels.find((c) => c.id === a.discordChannelId)?.name ?? a.discordChannelId}</p>
            </div>
            <form action={deleteAlert.bind(null, guildId, a.id)}>
              <button type="submit" className="rounded-full bg-coral-100 px-3 py-1 text-xs font-medium text-coral-600">
                Supprimer
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
