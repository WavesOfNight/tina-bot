import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildChannels } from "@/lib/discord";

async function saveModLogChannel(guildId: string, formData: FormData) {
  "use server";
  const modLogChannelId = (formData.get("modLogChannelId") as string) || null;
  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, modLogChannelId },
    update: { modLogChannelId },
  });
  revalidatePath(`/dashboard/${guildId}/moderation`);
}

const TYPE_LABELS: Record<string, string> = {
  WARN: "Avertissement",
  MUTE: "Mute",
  UNMUTE: "Fin de mute",
  KICK: "Expulsion",
  BAN: "Bannissement",
  UNBAN: "Fin de ban",
};

export default async function ModerationPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [guild, channels, cases] = await Promise.all([
    prisma.guild.findUnique({ where: { id: guildId } }),
    getGuildChannels(guildId),
    prisma.moderationCase.findMany({ where: { guildId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const save = saveModLogChannel.bind(null, guildId);

  return (
    <div>
      <h1 className="font-display mb-4 flex items-center gap-2 text-xl font-semibold text-lavender-900">
        <span aria-hidden="true">🛡️</span> Moderation
      </h1>

      <form action={save} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Salon de logs de moderation</label>
          <select name="modLogChannelId" defaultValue={guild?.modLogChannelId ?? ""} className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="">Aucun</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                # {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer
        </button>
      </form>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        <p className="border-b border-lavender-100 px-4 py-2 text-xs text-lavender-500">
          Commandes disponibles : /ban /kick /mute /warn /warnings /clear
        </p>
        {cases.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucun cas de moderation enregistre.</p>}
        {cases.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="text-sm font-medium text-lavender-900">
                #{c.id} - {TYPE_LABELS[c.type] ?? c.type} - {c.userId}
              </p>
              <p className="text-xs text-lavender-600">{c.reason ?? "Aucune raison fournie"}</p>
            </div>
            <span className="text-xs text-lavender-400">{c.createdAt.toLocaleDateString("fr-FR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
