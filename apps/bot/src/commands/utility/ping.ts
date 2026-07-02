import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Affiche la latence du bot"),
  async execute(interaction) {
    const sent = await interaction.reply({ content: "Calcul en cours...", fetchReply: true });
    const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = Math.round(interaction.client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle("🏓 Pong !")
      .addFields(
        { name: "Latence du message", value: `${roundTrip}ms`, inline: true },
        { name: "Latence WebSocket", value: `${wsLatency}ms`, inline: true },
      );

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};

export default command;
