import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { logCase } from "../../lib/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Rend un membre muet temporairement (timeout Discord)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a rendre muet").setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName("minutes").setDescription("Duree en minutes (max 40320 = 28 jours)").setRequired(true).setMinValue(1).setMaxValue(40320),
    )
    .addStringOption((opt) => opt.setName("raison").setDescription("Raison du mute")),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("raison");

    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({ content: "Ce membre n'est pas sur le serveur.", ephemeral: true });
      return;
    }
    if (!targetMember.moderatable) {
      await interaction.reply({ content: "Je ne peux pas rendre ce membre muet (role trop eleve).", ephemeral: true });
      return;
    }

    const durationMs = minutes * 60_000;
    await targetMember.timeout(durationMs, reason ?? undefined);

    await logCase({
      guild: interaction.guild,
      userId: target.id,
      moderatorId: interaction.user.id,
      type: "MUTE",
      reason,
      expiresAt: new Date(Date.now() + durationMs),
    });

    await interaction.reply(`${target.tag} est muet pendant ${minutes} minute(s). ${reason ? `Raison : ${reason}` : ""}`);
  },
};

export default command;
