import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder().setName("leaderboard").setDescription("Classement des membres les plus actifs"),
  async execute(interaction) {
    if (!interaction.guild) return;

    const top = await prisma.member.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: { xp: "desc" },
      take: 10,
    });

    if (top.length === 0) {
      await interaction.reply({ content: "Personne n'a encore gagne d'experience ici.", ephemeral: true });
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];
    const lines = top.map(
      (m, i) => `${medals[i] ?? `${i + 1}.`} <@${m.userId}> - niveau ${m.level} (${m.xp} XP)`,
    );

    const embed = new EmbedBuilder()
      .setColor(0x639922)
      .setTitle(`Classement de ${interaction.guild.name}`)
      .setDescription(lines.join("\n"));

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
