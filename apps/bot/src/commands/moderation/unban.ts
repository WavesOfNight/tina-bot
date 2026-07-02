import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";
import { logCase } from "../../lib/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Debannit un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((opt) => opt.setName("id_utilisateur").setDescription("L'ID Discord du membre a debannir").setRequired(true))
    .addStringOption((opt) => opt.setName("raison").setDescription("Raison du debannissement")),
  async execute(interaction) {
    if (!interaction.guild) return;
    const userId = interaction.options.getString("id_utilisateur", true).trim();
    const reason = interaction.options.getString("raison");

    const unbanned = await interaction.guild.members.unban(userId, reason ?? undefined).catch(() => null);
    if (!unbanned) {
      await interaction.reply({ content: "Ce membre n'est pas banni ou l'ID est invalide.", ephemeral: true });
      return;
    }

    await prisma.moderationCase.updateMany({
      where: { guildId: interaction.guild.id, userId, type: "BAN", resolved: false },
      data: { resolved: true },
    });

    await logCase({ guild: interaction.guild, userId, moderatorId: interaction.user.id, type: "UNBAN", reason });
    await interaction.reply(`<@${userId}> a ete debanni. ${reason ? `Raison : ${reason}` : ""}`);
  },
};

export default command;
