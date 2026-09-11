import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { PageHeader } from "@/components/PageHeader";
import { ScrollText, RotateCcw } from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  AVERTISSEMENT: "Avertissement",
  TIMEOUT: "Timeout",
  BAN: "Bannissement",
};

const TYPE_COLORS: Record<string, string> = {
  AVERTISSEMENT: "bg-lavender-100 text-lavender-700",
  TIMEOUT: "bg-cream-200 text-cream-800",
  BAN: "bg-coral-100 text-coral-600",
};

const ESCALATION_TYPES = ["AVERTISSEMENT", "TIMEOUT", "BAN"];

async function resetWarnings(formData: FormData) {
  "use server";
  const username = (formData.get("username") as string)?.trim();
  if (!username) return;
  await prisma.twitchModerationCase.deleteMany({ where: { username } });
  revalidatePath("/dashboard/twitch/logs");
}

export default async function TwitchLogsPage() {
  const cases = await prisma.twitchModerationCase.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  const violationCounts = new Map<string, number>();
  for (const c of cases) {
    if (!ESCALATION_TYPES.includes(c.type)) continue;
    violationCounts.set(c.username, (violationCounts.get(c.username) ?? 0) + 1);
  }
  const activeUsers = [...violationCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <PageHeader icon={ScrollText} title="Logs" subtitle="Historique des actions de moderation automatique sur le chat Twitch" />

      {activeUsers.length > 0 && (
        <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
          <h2 className="mb-1 text-sm font-medium text-lavender-800">Avertissements en cours</h2>
          <p className="mb-3 text-xs text-lavender-500">
            Si le bot a fait une bavure (mauvais mot filtre, faux positif...), reinitialise le compteur d&apos;un joueur ici - son
            prochain message repartira a &quot;avertissement 1/3&quot; au lieu de continuer l&apos;escalade. Si la personne est
            actuellement bannie sur Twitch, ca ne l&apos;annule pas automatiquement : tape{" "}
            <code className="rounded bg-lavender-100 px-1">/unban pseudo</code> dans ton chat Twitch pour la debannir en plus.
          </p>
          <div className="space-y-2">
            {activeUsers.map(([username, count]) => (
              <div key={username} className="flex items-center justify-between gap-3 rounded-xl border border-lavender-200 bg-white/60 px-3 py-2">
                <p className="text-sm text-lavender-900">
                  <span className="font-medium">{username}</span>{" "}
                  <span className="text-xs text-lavender-500">
                    ({count} violation{count > 1 ? "s" : ""} enregistree{count > 1 ? "s" : ""})
                  </span>
                </p>
                <form action={resetWarnings}>
                  <input type="hidden" name="username" value={username} />
                  <button
                    type="submit"
                    className="flex items-center gap-1 rounded-full bg-aqua-100 px-3 py-1 text-xs font-medium text-aqua-600"
                  >
                    <RotateCcw size={12} /> Reinitialiser
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {cases.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucun evenement de moderation enregistre pour le moment.</p>}
        {cases.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="text-sm font-medium text-lavender-900">
                <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[c.type] ?? "bg-lavender-100 text-lavender-700"}`}>
                  {TYPE_LABELS[c.type] ?? c.type}
                </span>
                {c.username}
              </p>
              <p className="text-xs text-lavender-600">{c.reason ?? "Aucune raison fournie"}</p>
            </div>
            <span className="text-xs text-lavender-400">{c.createdAt.toLocaleString("fr-FR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
