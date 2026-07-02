import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("Change le pseudo d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a renommer").setRequired(true))
    .addStringOption((opt) => opt.setName("pseudo").setDescription("Nouveau pseudo (laisse vide pour reinitialiser)")),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre", true);
    const nickname = interaction.options.getString("pseudo");

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member || !member.manageable) {
      await interaction.reply({ content: "Je ne peux pas modifier le pseudo de ce membre.", ephemeral: true });
      return;
    }

    await member.setNickname(nickname);
    await interaction.reply(nickname ? `Pseudo de ${target.tag} change en **${nickname}**.` : `Pseudo de ${target.tag} reinitialise.`);
  },
};

export default command;
