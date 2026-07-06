import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getEconomyLeaderboard } from "@tina/database";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder().setName("classement-pieces").setDescription("Classement des membres les plus riches"),
  async execute(interaction) {
    if (!interaction.guild) return;

    const top = await getEconomyLeaderboard(interaction.guild.id, 10);
    if (top.length === 0) {
      await interaction.reply({ content: "Personne n'a encore de pieces ici.", ephemeral: true });
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];
    const lines = top.map((m, i) => `${medals[i] ?? `${i + 1}.`} <@${m.userId}> - ${m.balance} piece${m.balance > 1 ? "s" : ""}`);

    const embed = new EmbedBuilder()
      .setColor(0xf5c451)
      .setTitle(`Les plus riches de ${interaction.guild.name}`)
      .setDescription(lines.join("\n"));

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
