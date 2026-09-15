import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { checkSocialAlerts } from "../../lib/social-alerts.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("alertes")
    .setDescription("Gestion des alertes YouTube/Twitch")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("verifier")
        .setDescription("Verifie maintenant les alertes de ce serveur et rattrape celles qui n'ont pas ete envoyees"),
    ),
  async execute(interaction) {
    if (!interaction.guildId) return;
    await interaction.deferReply({ ephemeral: true });

    const { sent } = await checkSocialAlerts(interaction.client, { guildId: interaction.guildId });

    await interaction.editReply(
      sent > 0
        ? `✅ ${sent} notification(s) manquante(s) envoyee(s) - chaque video/live n'est jamais notifie deux fois grace a l'historique enregistre.`
        : "✅ Verification terminee, rien a rattraper (tout est deja a jour).",
    );
  },
};

export default command;
