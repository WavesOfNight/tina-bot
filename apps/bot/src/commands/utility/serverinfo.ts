import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder().setName("serverinfo").setDescription("Affiche les informations du serveur"),
  async execute(interaction) {
    if (!interaction.guild) return;
    const guild = interaction.guild;
    const owner = await guild.fetchOwner().catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: "Proprietaire", value: owner ? `<@${owner.id}>` : "Inconnu", inline: true },
        { name: "Membres", value: `${guild.memberCount}`, inline: true },
        { name: "Salons", value: `${guild.channels.cache.size}`, inline: true },
        { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
        { name: "Emojis", value: `${guild.emojis.cache.size}`, inline: true },
        { name: "Cree le", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
