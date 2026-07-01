import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";

const BUILTIN_COMMANDS = [
  { name: "hello", description: "Dit bonjour" },
  { name: "hug", description: "Fais un calin a quelqu'un" },
  { name: "morpion", description: "Partie de tic-tac-toe" },
  { name: "puissance4", description: "Partie de puissance 4" },
  { name: "chifumi", description: "Pierre-feuille-ciseaux en duel" },
  { name: "trivia", description: "Quiz de culture generale/gaming/anime" },
  { name: "bombe", description: "Jeu du mot le plus rapide" },
  { name: "histoire", description: "Histoire collaborative mot par mot" },
  { name: "combattre", description: "Battle royale textuel" },
  { name: "loto", description: "Jeu du loto" },
  { name: "rank", description: "Affiche ton niveau" },
  { name: "leaderboard", description: "Classement du serveur" },
  { name: "ban", description: "Bannit un membre" },
  { name: "kick", description: "Expulse un membre" },
  { name: "mute", description: "Rend un membre muet" },
  { name: "warn", description: "Avertit un membre" },
  { name: "warnings", description: "Liste les avertissements" },
  { name: "clear", description: "Supprime des messages" },
  { name: "giveaway", description: "Gere les giveaways" },
  { name: "customcommand", description: "Gere les commandes perso" },
  { name: "reactionrole", description: "Gere les reaction-roles" },
  { name: "help", description: "Liste toutes les commandes" },
];

async function toggleCommand(guildId: string, name: string, enabled: boolean) {
  "use server";
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.slashCommandToggle.upsert({
    where: { guildId_name: { guildId, name } },
    create: { guildId, name, enabled },
    update: { enabled },
  });
  revalidatePath(`/dashboard/${guildId}/slash-commands`);
}

export default async function SlashCommandsPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const toggles = await prisma.slashCommandToggle.findMany({ where: { guildId } });
  const toggleMap = new Map(toggles.map((t) => [t.name, t.enabled]));

  return (
    <div>
      <h1 className="font-display mb-4 flex items-center gap-2 text-xl font-semibold text-lavender-900">
        <span aria-hidden="true">/</span> Slash Commands
      </h1>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {BUILTIN_COMMANDS.map((cmd) => {
          const enabled = toggleMap.get(cmd.name) ?? true;
          return (
            <div key={cmd.name} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
              <div>
                <p className="font-medium text-lavender-900">/{cmd.name}</p>
                <p className="text-xs text-lavender-600">{cmd.description}</p>
              </div>
              <form action={toggleCommand.bind(null, guildId, cmd.name, !enabled)}>
                <button
                  type="submit"
                  className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                    enabled ? "bg-aqua-200 text-aqua-800" : "bg-lavender-100 text-lavender-500"
                  }`}
                >
                  {enabled ? "Active" : "Desactive"}
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
