import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder().setName("help").setDescription("Liste toutes les commandes de Tina [BOT]"),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle("Commandes de Tina [BOT]")
      .addFields(
        { name: "Fun", value: "/hello, /hug" },
        { name: "Jeux (1v1)", value: "/morpion, /puissance4, /chifumi, /loto" },
        { name: "Jeux (party)", value: "/trivia, /bombe, /histoire, /combattre" },
        { name: "Niveaux", value: "/rank, /leaderboard" },
        { name: "Moderation", value: "/ban, /kick, /mute, /warn, /warnings, /clear" },
        { name: "Giveaways", value: "/giveaway start|end|reroll|list" },
        { name: "Reaction roles", value: "/reactionrole create|addrole" },
        { name: "Commandes perso", value: "/customcommand add|remove|list" },
      )
      .setFooter({ text: "Configure tout depuis le panel web de Tina [BOT]." });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
