import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Affiche les informations d'un role")
    .addRoleOption((opt) => opt.setName("role").setDescription("Le role a consulter").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guild) return;
    const roleOption = interaction.options.getRole("role", true);
    const role = await interaction.guild.roles.fetch(roleOption.id);
    if (!role) {
      await interaction.reply({ content: "Role introuvable.", ephemeral: true });
      return;
    }
    const memberCount = interaction.guild.members.cache.filter((m) => m.roles.cache.has(role.id)).size;

    const embed = new EmbedBuilder()
      .setColor(typeof role.color === "number" && role.color !== 0 ? role.color : 0x7f77dd)
      .setTitle(role.name)
      .addFields(
        { name: "ID", value: role.id, inline: true },
        { name: "Couleur", value: role.hexColor, inline: true },
        { name: "Membres", value: `${memberCount}`, inline: true },
        { name: "Mentionnable", value: role.mentionable ? "Oui" : "Non", inline: true },
        { name: "Affiche separement", value: role.hoist ? "Oui" : "Non", inline: true },
        { name: "Cree le", value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`, inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
