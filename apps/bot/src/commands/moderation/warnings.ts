import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Affiche les avertissements d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a consulter").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre", true);

    const cases = await prisma.moderationCase.findMany({
      where: { guildId: interaction.guild.id, userId: target.id, type: "WARN" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (cases.length === 0) {
      await interaction.reply({ content: `${target.tag} n'a aucun avertissement.`, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xba7517)
      .setTitle(`Avertissements de ${target.tag}`)
      .setDescription(
        cases
          .map((c) => `#${c.id} - <t:${Math.floor(c.createdAt.getTime() / 1000)}:R> - ${c.reason ?? "Aucune raison"}`)
          .join("\n"),
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
