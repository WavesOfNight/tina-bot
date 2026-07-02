import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { PageHeader } from "@/components/PageHeader";
import { SlashSquare } from "lucide-react";

const CATEGORIES: { label: string; commands: { name: string; description: string }[] }[] = [
  {
    label: "Utilitaires",
    commands: [
      { name: "ping", description: "Affiche la latence du bot" },
      { name: "userinfo", description: "Informations sur un membre" },
      { name: "serverinfo", description: "Informations sur le serveur" },
      { name: "avatar", description: "Affiche un avatar en grand" },
      { name: "roleinfo", description: "Informations sur un role" },
      { name: "poll", description: "Cree un sondage a boutons" },
      { name: "remindme", description: "Programme un rappel" },
      { name: "8ball", description: "Boule magique" },
    ],
  },
  {
    label: "Fun",
    commands: [
      { name: "hello", description: "Dit bonjour" },
      { name: "hug", description: "Fais un calin a quelqu'un" },
      { name: "meme", description: "Affiche un meme aleatoire" },
    ],
  },
  {
    label: "Jeux en duel",
    commands: [
      { name: "morpion", description: "Partie de tic-tac-toe (manches disponibles)" },
      { name: "puissance4", description: "Partie de puissance 4 (manches disponibles)" },
      { name: "chifumi", description: "Pierre-feuille-ciseaux en duel (manches disponibles)" },
      { name: "loto", description: "Jeu du loto" },
      { name: "echecs", description: "Echecs complets en duel" },
      { name: "dames", description: "Dames en duel" },
    ],
  },
  {
    label: "Jeux en groupe",
    commands: [
      { name: "trivia", description: "Quiz de culture generale/gaming/anime" },
      { name: "bombe", description: "Jeu du mot le plus rapide" },
      { name: "histoire", description: "Histoire collaborative mot par mot" },
      { name: "combattre", description: "Battle royale textuel" },
      { name: "pendu", description: "Pendu collaboratif, devine le mot lettre par lettre" },
    ],
  },
  {
    label: "Jeux solo",
    commands: [{ name: "blackjack", description: "Blackjack contre le croupier" }],
  },
  {
    label: "Niveaux",
    commands: [
      { name: "rank", description: "Affiche ton niveau" },
      { name: "leaderboard", description: "Classement du serveur" },
    ],
  },
  {
    label: "Moderation",
    commands: [
      { name: "warn", description: "Avertit un membre" },
      { name: "warnings", description: "Liste les avertissements" },
      { name: "mute", description: "Rend un membre muet" },
      { name: "unmute", description: "Retire le mute d'un membre" },
      { name: "kick", description: "Expulse un membre" },
      { name: "ban", description: "Bannit un membre (temporaire ou definitif)" },
      { name: "unban", description: "Debannit un membre" },
      { name: "clear", description: "Supprime des messages" },
      { name: "slowmode", description: "Regle le mode lent d'un salon" },
      { name: "nickname", description: "Change le pseudo d'un membre" },
      { name: "say", description: "Fait envoyer un message au bot" },
    ],
  },
  {
    label: "Serveur",
    commands: [
      { name: "giveaway", description: "Gere les giveaways" },
      { name: "customcommand", description: "Gere les commandes perso" },
      { name: "reactionrole", description: "Gere les reaction-roles" },
      { name: "help", description: "Liste toutes les commandes" },
    ],
  },
  {
    label: "Radio",
    commands: [{ name: "son", description: "Infos sur la radio READS (actuel, historique, auditeurs)" }],
  },
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
  const totalCommands = CATEGORIES.reduce((sum, cat) => sum + cat.commands.length, 0);

  return (
    <div>
      <PageHeader icon={SlashSquare} title={`Slash Commands (${totalCommands})`} subtitle="Active ou desactive chaque commande sur ce serveur" />

      {CATEGORIES.map((category) => (
        <div key={category.label} className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-lavender-800">{category.label}</h2>
          <div className="glass-panel rounded-aero p-2 shadow-glass">
            {category.commands.map((cmd) => {
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
      ))}
    </div>
  );
}
