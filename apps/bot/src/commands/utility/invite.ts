import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { ensurePermanentInvite } from "../../lib/invite.js";

const command: Command = {
  data: new SlashCommandBuilder().setName("invite").setDescription("Affiche le lien d'invitation permanent du serveur"),
  async execute(interaction) {
    if (!interaction.guild || !interaction.channelId) return;

    await interaction.deferReply();

    const code = await ensurePermanentInvite(interaction.guild, interaction.channelId);
    if (!code) {
      await interaction.editReply(
        "Impossible de creer un lien d'invitation ici. Verifie que j'ai la permission de creer des invitations dans ce salon.",
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Rejoins ${interaction.guild.name} !`)
      .setDescription(`https://discord.gg/${code}`)
      .setThumbnail(interaction.guild.iconURL({ size: 256 }))
      .setFooter({ text: "Lien permanent : n'expire jamais et n'a pas de limite d'utilisation." });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
