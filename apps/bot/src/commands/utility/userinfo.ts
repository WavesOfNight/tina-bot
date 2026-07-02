import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Affiche les informations d'un membre")
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a consulter")),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre") ?? interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle(target.tag)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "ID", value: target.id, inline: true },
        { name: "Compte cree le", value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
      );

    if (member) {
      embed.addFields(
        { name: "A rejoint le", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : "Inconnu", inline: true },
        { name: "Pseudo", value: member.nickname ?? "Aucun", inline: true },
        {
          name: `Roles (${member.roles.cache.size - 1})`,
          value: member.roles.cache.filter((r) => r.id !== interaction.guild!.id).map((r) => `<@&${r.id}>`).slice(0, 20).join(", ") || "Aucun",
        },
      );
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
