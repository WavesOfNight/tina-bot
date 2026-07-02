import { SlashCommandBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";
import { parseDuration } from "../../lib/duration.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("remindme")
    .setDescription("Programme un rappel")
    .addStringOption((opt) => opt.setName("dans").setDescription("Delai (ex: 10m, 2h, 1d)").setRequired(true))
    .addStringOption((opt) => opt.setName("message").setDescription("Le message du rappel").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const durationInput = interaction.options.getString("dans", true);
    const message = interaction.options.getString("message", true);

    const durationMs = parseDuration(durationInput);
    if (!durationMs) {
      await interaction.reply({ content: "Delai invalide. Exemple : 10m, 2h, 1d.", ephemeral: true });
      return;
    }

    const remindAt = new Date(Date.now() + durationMs);
    await prisma.reminder.create({
      data: { guildId: interaction.guildId, channelId: interaction.channelId, userId: interaction.user.id, message, remindAt },
    });

    await interaction.reply({ content: `⏰ Rappel programme pour <t:${Math.floor(remindAt.getTime() / 1000)}:R>.`, ephemeral: true });
  },
};

export default command;
