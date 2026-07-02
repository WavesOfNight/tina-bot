import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Affiche l'avatar d'un membre en grand")
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a consulter")),
  async execute(interaction) {
    const target = interaction.options.getUser("membre") ?? interaction.user;

    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle(`Avatar de ${target.username}`)
      .setImage(target.displayAvatarURL({ size: 1024 }));

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
