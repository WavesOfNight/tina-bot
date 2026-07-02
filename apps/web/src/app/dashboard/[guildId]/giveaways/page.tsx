import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildChannels } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { PartyPopper } from "lucide-react";

async function createGiveaway(guildId: string, formData: FormData) {
  "use server";
  const prize = formData.get("prize") as string;
  const channelId = formData.get("channelId") as string;
  const winnerCount = Number(formData.get("winnerCount") || 1);
  const durationMinutes = Number(formData.get("durationMinutes") || 60);
  if (!prize || !channelId) return;

  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.giveaway.create({
    data: {
      guildId,
      channelId,
      prize,
      winnerCount,
      hostId: "dashboard",
      endsAt: new Date(Date.now() + durationMinutes * 60_000),
    },
  });
  revalidatePath(`/dashboard/${guildId}/giveaways`);
}

async function endGiveawayNow(guildId: string, id: number) {
  "use server";
  await prisma.giveaway.update({ where: { id }, data: { endsAt: new Date() } });
  revalidatePath(`/dashboard/${guildId}/giveaways`);
}

export default async function GiveawaysPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [channels, giveaways] = await Promise.all([
    getGuildChannels(guildId),
    prisma.giveaway.findMany({ where: { guildId }, orderBy: { createdAt: "desc" }, take: 20, include: { entries: true } }),
  ]);

  const create = createGiveaway.bind(null, guildId);

  return (
    <div>
      <PageHeader icon={PartyPopper} title="Giveaways" subtitle="Lance et gere des concours avec participation par bouton" />

      <form action={create} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Prix</label>
          <input name="prize" required placeholder="Nitro 1 mois" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Salon</label>
          <select name="channelId" required className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                # {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Gagnants</label>
          <input type="number" name="winnerCount" defaultValue={1} min={1} max={20} className="w-20 rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Duree (minutes)</label>
          <input type="number" name="durationMinutes" defaultValue={60} min={1} className="w-24 rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-blush-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Lancer
        </button>
      </form>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {giveaways.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucun giveaway pour le moment.</p>}
        {giveaways.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="font-medium text-lavender-900">
                #{g.id} - {g.prize} {g.ended && <span className="text-xs text-lavender-400">(termine)</span>}
              </p>
              <p className="text-xs text-lavender-600">
                {g.entries.length} participant(s) - {g.winnerCount} gagnant(s)
              </p>
            </div>
            {!g.ended && (
              <form action={endGiveawayNow.bind(null, guildId, g.id)}>
                <button type="submit" className="rounded-full bg-coral-100 px-3 py-1 text-xs font-medium text-coral-600">
                  Terminer
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
