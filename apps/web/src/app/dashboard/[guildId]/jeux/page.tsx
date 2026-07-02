import { prisma } from "@tina/database";
import { PageHeader } from "@/components/PageHeader";
import { Gamepad2 } from "lucide-react";

const GAMES = [
  { key: "MORPION", command: "/morpion", description: "Defie un membre au tic-tac-toe via des boutons.", statLabel: (g: { wins: number; losses: number; draws: number }) => `${g.wins}V / ${g.losses}D / ${g.draws}N` },
  { key: "CONNECT4", command: "/puissance4", description: "Le classique 7x6, aligne 4 jetons avant ton adversaire.", statLabel: (g: { wins: number; losses: number; draws: number }) => `${g.wins}V / ${g.losses}D / ${g.draws}N` },
  { key: "CHIFUMI", command: "/chifumi", description: "Pierre-feuille-ciseaux en duel prive.", statLabel: (g: { wins: number; losses: number; draws: number }) => `${g.wins}V / ${g.losses}D / ${g.draws}N` },
  { key: "TRIVIA", command: "/trivia", description: "Question de culture generale, gaming ou anime. Le plus rapide gagne.", statLabel: (g: { wins: number; plays: number }) => `${g.wins} bonnes reponses / ${g.plays} tentatives` },
  { key: "BOMBE", command: "/bombe", description: "Trouve un mot contenant la syllabe donnee en moins de 10s.", statLabel: (g: { wins: number; plays: number }) => `${g.wins} bombes desamorcees` },
  { key: "RUMBLE", command: "/combattre", description: "Battle royale textuel jusqu'a 30 joueurs, elimination toutes les 5s.", statLabel: (g: { wins: number }) => `${g.wins} victoire(s)` },
  { key: "LOTO", command: "/loto", description: "Choisis 3 numeros entre 1 et 49 et tente de trouver le tirage.", statLabel: (g: { wins: number; plays: number }) => `${g.wins} jackpot(s) / ${g.plays} parties` },
  { key: "PENDU", command: "/pendu", description: "Devine le mot lettre par lettre avant que le pendu soit complet.", statLabel: (g: { wins: number; plays: number }) => `${g.wins} mot(s) trouve(s) / ${g.plays} parties` },
  { key: "BLACKJACK", command: "/blackjack", description: "Affronte le croupier, le plus proche de 21 sans depasser gagne.", statLabel: (g: { wins: number; losses: number; draws: number }) => `${g.wins}V / ${g.losses}D / ${g.draws}N` },
  { key: "ECHECS", command: "/echecs", description: "Echecs complets en duel : coups, echec et mat, pat.", statLabel: (g: { wins: number; losses: number; draws: number }) => `${g.wins}V / ${g.losses}D / ${g.draws}N` },
  { key: "DAMES", command: "/dames", description: "Dames en duel : deplacements et prises en diagonale.", statLabel: (g: { wins: number; losses: number; draws: number }) => `${g.wins}V / ${g.losses}D / ${g.draws}N` },
];

export default async function JeuxPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const statsByGame = await Promise.all(
    GAMES.map((game) =>
      prisma.gameStat.findMany({ where: { guildId, game: game.key }, orderBy: { wins: "desc" }, take: 10 }),
    ),
  );

  return (
    <div>
      <PageHeader icon={Gamepad2} title="Jeux" subtitle="Toutes les stats des jeux du serveur" />
      <p className="mb-4 text-sm text-lavender-600">
        Jeux au tour par tour, party games et le battle royale <span className="font-medium">/combattre</span> — tous
        fonctionnent des la commande, aucune configuration requise ici, juste les stats.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {GAMES.map((game, index) => {
          const stats = statsByGame[index];
          return (
            <div key={game.key} className="glass-panel rounded-aero p-5 shadow-glass">
              <h2 className="mb-1 text-sm font-medium text-lavender-800">{game.command}</h2>
              <p className="mb-3 text-xs text-lavender-600">{game.description}</p>
              <div className="space-y-1">
                {stats.length === 0 && <p className="text-sm text-lavender-600">Pas encore de partie jouee.</p>}
                {stats.map((g) => (
                  <div key={g.id} className="flex items-center justify-between rounded-lg bg-white/40 px-2 py-1.5 text-sm">
                    <span>{g.userId}</span>
                    <span className="text-xs text-lavender-600">{game.statLabel(g)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
