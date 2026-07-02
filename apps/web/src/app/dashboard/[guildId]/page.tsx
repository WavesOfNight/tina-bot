import { prisma } from "@tina/database";
import { PageHeader } from "@/components/PageHeader";

const TYPE_LABELS: Record<string, string> = {
  WARN: "Avertissement",
  MUTE: "Mute",
  UNMUTE: "Fin de mute",
  KICK: "Expulsion",
  BAN: "Bannissement",
  UNBAN: "Fin de ban",
  AUTOMOD: "Filtre auto",
};

export default async function OverviewPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;

  const [memberCount, commandCount, activeGiveaways, caseCount, recentCases, topMembers, autoResponseCount, alertCount] = await Promise.all([
    prisma.member.count({ where: { guildId } }),
    prisma.customCommand.count({ where: { guildId } }),
    prisma.giveaway.count({ where: { guildId, ended: false } }),
    prisma.moderationCase.count({ where: { guildId } }),
    prisma.moderationCase.findMany({ where: { guildId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.member.findMany({ where: { guildId }, orderBy: { xp: "desc" }, take: 5 }),
    prisma.autoResponse.count({ where: { guildId } }),
    prisma.socialAlert.count({ where: { guildId } }),
  ]);

  const cards = [
    { label: "Membres avec XP", value: memberCount, color: "bg-lavender-100 text-lavender-800" },
    { label: "Commandes perso", value: commandCount, color: "bg-aqua-100 text-aqua-800" },
    { label: "Giveaways actifs", value: activeGiveaways, color: "bg-blush-100 text-blush-800" },
    { label: "Cas de moderation", value: caseCount, color: "bg-coral-100 text-coral-600" },
    { label: "Reponses automatiques", value: autoResponseCount, color: "bg-lavender-100 text-lavender-800" },
    { label: "Alertes sociales", value: alertCount, color: "bg-aqua-100 text-aqua-800" },
  ];

  return (
    <div>
      <PageHeader icon="🏠" title="Tableau de bord" subtitle="Vue d'ensemble de ton serveur" />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className={`glass-panel rounded-aero p-4 shadow-glass ${card.color}`}>
            <p className="text-2xl font-semibold">{card.value}</p>
            <p className="text-xs">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-aero p-5 shadow-glass">
          <h2 className="mb-3 text-sm font-medium text-lavender-800">Top membres (XP)</h2>
          <div className="space-y-1">
            {topMembers.length === 0 && <p className="text-sm text-lavender-600">Personne n&apos;a encore gagne d&apos;experience.</p>}
            {topMembers.map((m, i) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm odd:bg-white/40">
                <span>
                  #{i + 1} - {m.userId}
                </span>
                <span className="rounded-full bg-aqua-100 px-2 py-0.5 text-xs font-medium text-aqua-800">Nv {m.level}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-aero p-5 shadow-glass">
          <h2 className="mb-3 text-sm font-medium text-lavender-800">Activite de moderation recente</h2>
          <div className="space-y-1">
            {recentCases.length === 0 && <p className="text-sm text-lavender-600">Aucun cas de moderation.</p>}
            {recentCases.map((c) => (
              <div key={c.id} className="rounded-lg px-2 py-1.5 text-sm odd:bg-white/40">
                <span className="font-medium text-lavender-900">{TYPE_LABELS[c.type] ?? c.type}</span>{" "}
                <span className="text-lavender-600">- {c.userId}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
