import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getBalance } from "@tina/database";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Affiche ton solde de pieces")
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a consulter")),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre") ?? interaction.user;
    const balance = await getBalance(interaction.guild.id, target.id);

    const embed = new EmbedBuilder()
      .setColor(0xf5c451)
      .setTitle(`Portefeuille de ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`💰 **${balance}** piece${balance > 1 ? "s" : ""}`);

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
