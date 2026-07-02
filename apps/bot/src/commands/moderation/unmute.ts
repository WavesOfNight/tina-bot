import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { logCase } from "../../lib/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Retire le mute (timeout) d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a demuter").setRequired(true))
    .addStringOption((opt) => opt.setName("raison").setDescription("Raison")),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre", true);
    const reason = interaction.options.getString("raison");

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member || !member.isCommunicationDisabled()) {
      await interaction.reply({ content: "Ce membre n'est pas mute actuellement.", ephemeral: true });
      return;
    }

    await member.timeout(null, reason ?? undefined);
    await logCase({ guild: interaction.guild, userId: target.id, moderatorId: interaction.user.id, type: "UNMUTE", reason });

    await interaction.reply(`${target.tag} n'est plus mute. ${reason ? `Raison : ${reason}` : ""}`);
  },
};

export default command;
