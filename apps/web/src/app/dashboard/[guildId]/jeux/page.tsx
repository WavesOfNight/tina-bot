import { prisma } from "@tina/database";

export default async function JeuxPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [morpion, loto] = await Promise.all([
    prisma.gameStat.findMany({ where: { guildId, game: "MORPION" }, orderBy: { wins: "desc" }, take: 10 }),
    prisma.gameStat.findMany({ where: { guildId, game: "LOTO" }, orderBy: { wins: "desc" }, take: 10 }),
  ]);

  return (
    <div>
      <h1 className="font-display mb-4 flex items-center gap-2 text-xl font-semibold text-lavender-900">
        <span aria-hidden="true">🎮</span> Jeux
      </h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-aero p-5 shadow-glass">
          <h2 className="mb-3 text-sm font-medium text-lavender-800">Morpion (/morpion)</h2>
          <p className="mb-3 text-xs text-lavender-600">Defie un autre membre a une partie de tic-tac-toe via des boutons Discord.</p>
          <div className="space-y-1">
            {morpion.length === 0 && <p className="text-sm text-lavender-600">Pas encore de partie jouee.</p>}
            {morpion.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg bg-white/40 px-2 py-1.5 text-sm">
                <span>{g.userId}</span>
                <span className="text-xs text-lavender-600">
                  {g.wins}V / {g.losses}D / {g.draws}N
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-aero p-5 shadow-glass">
          <h2 className="mb-3 text-sm font-medium text-lavender-800">Loto (/loto)</h2>
          <p className="mb-3 text-xs text-lavender-600">Choisis 3 numeros entre 1 et 49 et tente de trouver le tirage.</p>
          <div className="space-y-1">
            {loto.length === 0 && <p className="text-sm text-lavender-600">Pas encore de tirage joue.</p>}
            {loto.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg bg-white/40 px-2 py-1.5 text-sm">
                <span>{g.userId}</span>
                <span className="text-xs text-lavender-600">
                  {g.wins} jackpot(s) / {g.plays} parties
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
