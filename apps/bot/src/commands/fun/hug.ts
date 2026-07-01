import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("hug")
    .setDescription("Fais un calin a quelqu'un")
    .addUserOption((opt) => opt.setName("membre").setDescription("La personne a caliner").setRequired(true)),
  async execute(interaction) {
    const target = interaction.options.getUser("membre", true);

    if (target.id === interaction.user.id) {
      await interaction.reply("Un auto-calin, c'est permis aussi ! Prends soin de toi.");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xd4537e)
      .setDescription(`${interaction.user} envoie un calin tout doux a ${target} !`);

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
