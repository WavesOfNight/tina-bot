import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { logCase } from "../../lib/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannit un membre du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a bannir").setRequired(true))
    .addStringOption((opt) => opt.setName("raison").setDescription("Raison du bannissement"))
    .addIntegerOption((opt) =>
      opt.setName("jours_messages").setDescription("Jours de messages a supprimer (0-7)").setMinValue(0).setMaxValue(7),
    ),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre", true);
    const reason = interaction.options.getString("raison");
    const deleteDays = interaction.options.getInteger("jours_messages") ?? 0;

    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (targetMember && !targetMember.bannable) {
      await interaction.reply({ content: "Je ne peux pas bannir ce membre (role trop eleve).", ephemeral: true });
      return;
    }

    await interaction.guild.members.ban(target.id, {
      reason: reason ?? undefined,
      deleteMessageSeconds: deleteDays * 86400,
    });

    await logCase({
      guild: interaction.guild,
      userId: target.id,
      moderatorId: interaction.user.id,
      type: "BAN",
      reason,
    });

    await interaction.reply(`${target.tag} a ete banni. ${reason ? `Raison : ${reason}` : ""}`);
  },
};

export default command;
