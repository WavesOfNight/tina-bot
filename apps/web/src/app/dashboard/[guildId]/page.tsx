import { prisma } from "@tina/database";

export default async function OverviewPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;

  const [memberCount, commandCount, activeGiveaways, caseCount] = await Promise.all([
    prisma.member.count({ where: { guildId } }),
    prisma.customCommand.count({ where: { guildId } }),
    prisma.giveaway.count({ where: { guildId, ended: false } }),
    prisma.moderationCase.count({ where: { guildId } }),
  ]);

  const cards = [
    { label: "Membres avec XP", value: memberCount, color: "bg-lavender-100 text-lavender-800" },
    { label: "Commandes perso", value: commandCount, color: "bg-aqua-100 text-aqua-800" },
    { label: "Giveaways actifs", value: activeGiveaways, color: "bg-blush-100 text-blush-800" },
    { label: "Cas de moderation", value: caseCount, color: "bg-coral-100 text-coral-600" },
  ];

  return (
    <div>
      <h1 className="font-display mb-4 text-xl font-semibold text-lavender-900">Tableau de bord</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={`glass-panel rounded-aero p-4 shadow-glass ${card.color}`}>
            <p className="text-2xl font-semibold">{card.value}</p>
            <p className="text-xs">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
