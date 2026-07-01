import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { logCase } from "../../lib/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Expulse un membre du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a expulser").setRequired(true))
    .addStringOption((opt) => opt.setName("raison").setDescription("Raison de l'expulsion")),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre", true);
    const reason = interaction.options.getString("raison");

    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({ content: "Ce membre n'est pas sur le serveur.", ephemeral: true });
      return;
    }
    if (!targetMember.kickable) {
      await interaction.reply({ content: "Je ne peux pas expulser ce membre (role trop eleve).", ephemeral: true });
      return;
    }

    await targetMember.kick(reason ?? undefined);

    await logCase({
      guild: interaction.guild,
      userId: target.id,
      moderatorId: interaction.user.id,
      type: "KICK",
      reason,
    });

    await interaction.reply(`${target.tag} a ete expulse. ${reason ? `Raison : ${reason}` : ""}`);
  },
};

export default command;
