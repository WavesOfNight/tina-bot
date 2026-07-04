import { prisma } from "@tina/database";
import { PageHeader } from "@/components/PageHeader";
import { ScrollText } from "lucide-react";

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

export default async function TwitchLogsPage() {
  const cases = await prisma.twitchModerationCase.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <div>
      <PageHeader icon={ScrollText} title="Logs" subtitle="Historique des actions de moderation automatique sur le chat Twitch" />

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
