import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { logCase } from "../../lib/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Donne un avertissement a un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a avertir").setRequired(true))
    .addStringOption((opt) => opt.setName("raison").setDescription("Raison de l'avertissement").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre", true);
    const reason = interaction.options.getString("raison", true);

    const moderationCase = await logCase({
      guild: interaction.guild,
      userId: target.id,
      moderatorId: interaction.user.id,
      type: "WARN",
      reason,
    });

    await target.send(`Tu as recu un avertissement sur **${interaction.guild.name}** : ${reason}`).catch(() => null);

    await interaction.reply(`${target.tag} a recu l'avertissement #${moderationCase.id}. Raison : ${reason}`);
  },
};

export default command;
