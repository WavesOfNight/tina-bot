import { revalidatePath } from "next/cache";
import { createTwitchTimer, deleteTwitchTimer, getTwitchTimers, updateTwitchTimer } from "@tina/database";
import { PageHeader } from "@/components/PageHeader";
import { Timer } from "lucide-react";

export const dynamic = "force-dynamic";

async function addTimer(formData: FormData) {
  "use server";
  const name = (formData.get("name") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();
  const intervalMinutes = Math.max(1, Number(formData.get("intervalMinutes")) || 10);
  const minMessages = Math.max(0, Number(formData.get("minMessages")) || 0);
  if (!name || !message) return;

  await createTwitchTimer({ name, message, intervalMinutes, minMessages });
  revalidatePath("/dashboard/twitch/timers");
}

async function toggleTimer(id: number, name: string, message: string, intervalMinutes: number, minMessages: number, enabled: boolean) {
  "use server";
  await updateTwitchTimer(id, { name, message, intervalMinutes, minMessages, enabled: !enabled });
  revalidatePath("/dashboard/twitch/timers");
}

async function removeTimer(id: number) {
  "use server";
  await deleteTwitchTimer(id);
  revalidatePath("/dashboard/twitch/timers");
}

export default async function TwitchTimersPage() {
  const timers = await getTwitchTimers();

  return (
    <div>
      <PageHeader icon={Timer} title="Timers" subtitle="Messages envoyes automatiquement dans le chat a intervalle regulier" />

      <form action={addTimer} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Nom</label>
          <input name="name" required placeholder="socials" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Message</label>
          <input
            name="message"
            required
            placeholder="N'oublie pas de rejoindre le Discord !"
            className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Intervalle (min)</label>
          <input name="intervalMinutes" type="number" min={1} defaultValue={10} className="w-24 rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Messages min. entre 2 envois</label>
          <input name="minMessages" type="number" min={0} defaultValue={0} className="w-24 rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-[#9146FF] px-5 py-2 text-sm font-medium text-white shadow-glass">
          Ajouter
        </button>
      </form>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {timers.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucun timer pour le moment.</p>}
        {timers.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="font-medium text-lavender-900">
                {t.name} {!t.enabled && <span className="text-xs text-lavender-400">(desactive)</span>}
              </p>
              <p className="text-sm text-lavender-600">{t.message}</p>
              <p className="text-xs text-lavender-400">
                toutes les {t.intervalMinutes} min - min. {t.minMessages} message(s) entre 2 envois
                {t.lastSentAt && ` - dernier envoi ${t.lastSentAt.toLocaleString("fr-FR")}`}
              </p>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <form action={toggleTimer.bind(null, t.id, t.name, t.message, t.intervalMinutes, t.minMessages, t.enabled)}>
                <button type="submit" className="rounded-full bg-lavender-100 px-3 py-1 text-xs font-medium text-lavender-700">
                  {t.enabled ? "Desactiver" : "Activer"}
                </button>
              </form>
              <form action={removeTimer.bind(null, t.id)}>
                <button type="submit" className="rounded-full bg-coral-100 px-3 py-1 text-xs font-medium text-coral-600">
                  Supprimer
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
