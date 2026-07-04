import { revalidatePath } from "next/cache";
import { cancelTwitchGiveaway, endTwitchGiveaway, getActiveTwitchGiveaway, getTwitchGiveawayHistory, startTwitchGiveaway } from "@tina/database";
import { PageHeader } from "@/components/PageHeader";
import { PartyPopper } from "lucide-react";

export const dynamic = "force-dynamic";

async function start(formData: FormData) {
  "use server";
  const keyword = (formData.get("keyword") as string)?.trim();
  const prize = (formData.get("prize") as string)?.trim();
  if (!keyword || !prize) return;

  try {
    await startTwitchGiveaway(keyword, prize);
  } catch {
    // un giveaway est deja en cours, on ignore
  }
  revalidatePath("/dashboard/twitch/giveaways");
}

async function end(id: number) {
  "use server";
  await endTwitchGiveaway(id);
  revalidatePath("/dashboard/twitch/giveaways");
}

async function cancel(id: number) {
  "use server";
  await cancelTwitchGiveaway(id);
  revalidatePath("/dashboard/twitch/giveaways");
}

export default async function TwitchGiveawaysPage() {
  const [active, history] = await Promise.all([getActiveTwitchGiveaway(), getTwitchGiveawayHistory(20)]);

  return (
    <div>
      <PageHeader icon={PartyPopper} title="Giveaways" subtitle="Lance un concours par mot-cle dans le chat Twitch" />

      {active ? (
        <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-aqua-400" />
            <p className="text-sm font-medium text-lavender-900">Giveaway en cours : {active.prize}</p>
          </div>
          <p className="mb-4 text-xs text-lavender-500">
            Mot-cle : <span className="font-mono">{active.keyword}</span> - {active.entries.length} participant(s)
          </p>
          <div className="flex gap-2">
            <form action={end.bind(null, active.id)}>
              <button type="submit" className="bubble-btn rounded-full bg-[#9146FF] px-5 py-2 text-sm font-medium text-white shadow-glass">
                Terminer et tirer au sort
              </button>
            </form>
            <form action={cancel.bind(null, active.id)}>
              <button type="submit" className="rounded-full bg-coral-100 px-5 py-2 text-sm font-medium text-coral-600">
                Annuler
              </button>
            </form>
          </div>
        </div>
      ) : (
        <form action={start} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
          <div>
            <label className="mb-1 block text-xs text-lavender-600">Mot-cle</label>
            <input name="keyword" required placeholder="!entrer" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-lavender-600">Lot a gagner</label>
            <input name="prize" required placeholder="1 mois d'abonnement" className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="bubble-btn rounded-full bg-[#9146FF] px-5 py-2 text-sm font-medium text-white shadow-glass">
            Lancer le giveaway
          </button>
        </form>
      )}

      <h2 className="mb-3 mt-6 text-sm font-semibold text-lavender-800">Historique</h2>
      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {history.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucun giveaway termine pour le moment.</p>}
        {history.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="font-medium text-lavender-900">{g.prize}</p>
              <p className="text-xs text-lavender-500">
                {g.status === "CANCELLED"
                  ? "Annule"
                  : g.winnerUsername
                    ? `Gagnant : @${g.winnerUsername}`
                    : "Termine sans participant"}
                {" - "}
                {g._count.entries} participant(s)
              </p>
            </div>
            <span className="text-xs text-lavender-400">{(g.endedAt ?? g.createdAt).toLocaleDateString("fr-FR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
