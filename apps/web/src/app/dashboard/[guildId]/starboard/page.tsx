import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildChannels } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { Star } from "lucide-react";

async function saveStarboard(guildId: string, formData: FormData) {
  "use server";
  const starboardChannelId = (formData.get("starboardChannelId") as string) || null;
  const starboardEmoji = (formData.get("starboardEmoji") as string)?.trim() || "⭐";
  const starboardThreshold = Math.max(1, Number(formData.get("starboardThreshold")) || 3);

  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, starboardChannelId, starboardEmoji, starboardThreshold },
    update: { starboardChannelId, starboardEmoji, starboardThreshold },
  });
  revalidatePath(`/dashboard/${guildId}/starboard`);
}

export default async function StarboardPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [guild, channels, posts] = await Promise.all([
    prisma.guild.findUnique({ where: { id: guildId } }),
    getGuildChannels(guildId),
    prisma.starboardPost.findMany({ where: { guildId }, orderBy: { starCount: "desc" }, take: 10 }),
  ]);

  const save = saveStarboard.bind(null, guildId);

  return (
    <div>
      <PageHeader icon={Star} title="Starboard" subtitle="Met en avant les messages les plus populaires du serveur" />

      <form action={save} className="glass-panel mb-4 space-y-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Salon starboard</label>
          <select name="starboardChannelId" defaultValue={guild?.starboardChannelId ?? ""} className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="">Desactive</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                # {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Emoji</label>
            <input name="starboardEmoji" defaultValue={guild?.starboardEmoji ?? "⭐"} maxLength={8} className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Seuil de reactions</label>
            <input name="starboardThreshold" type="number" min={1} defaultValue={guild?.starboardThreshold ?? 3} className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Enregistrer
        </button>
      </form>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">Messages les plus populaires</h2>
      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {posts.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucun message mis en avant pour le moment.</p>}
        {posts.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <span className="text-sm text-lavender-900">
              Message dans #{channels.find((c) => c.id === p.originalChannelId)?.name ?? p.originalChannelId}
            </span>
            <span className="rounded-full bg-aqua-100 px-2 py-0.5 text-xs font-medium text-aqua-800">{p.starCount} ⭐</span>
          </div>
        ))}
      </div>
    </div>
  );
}
