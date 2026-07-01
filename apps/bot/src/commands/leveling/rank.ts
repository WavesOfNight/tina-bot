import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";
import { xpProgress } from "../../lib/xp.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Affiche ton niveau et ton experience")
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a consulter")),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre") ?? interaction.user;

    const member = await prisma.member.findUnique({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: target.id } },
    });

    if (!member) {
      await interaction.reply({ content: `${target.tag} n'a pas encore d'experience sur ce serveur.`, ephemeral: true });
      return;
    }

    const rankPosition = await prisma.member.count({
      where: { guildId: interaction.guild.id, xp: { gt: member.xp } },
    });

    const { current, needed } = xpProgress(member.xp, member.level);

    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle(`Niveau de ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "Rang", value: `#${rankPosition + 1}`, inline: true },
        { name: "Niveau", value: `${member.level}/50`, inline: true },
        { name: "Experience", value: `${current}/${needed} XP`, inline: true },
        { name: "Messages envoyes", value: `${member.messages}`, inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
