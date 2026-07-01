import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { bombeRounds, pickSyllable } from "../../lib/bombe-store.js";

const ROUND_DURATION_MS = 10_000;

const command: Command = {
  data: new SlashCommandBuilder().setName("bombe").setDescription("Lance le jeu du mot le plus rapide dans ce salon"),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.channelId) return;

    if (bombeRounds.get(interaction.channelId)?.active) {
      await interaction.reply({ content: "Une bombe est deja active dans ce salon !", ephemeral: true });
      return;
    }

    const syllable = pickSyllable();
    bombeRounds.set(interaction.channelId, { syllable, guildId: interaction.guildId, active: true });

    await interaction.reply(
      `💣 **BOMBE !** Trouve un mot contenant **${syllable}** en moins de 10 secondes ! Tape un seul mot dans le chat.`,
    );

    setTimeout(async () => {
      const round = bombeRounds.get(interaction.channelId!);
      if (round?.active) {
        bombeRounds.delete(interaction.channelId!);
        await interaction.followUp(`💥 Boom ! Personne n'a trouve de mot avec **${syllable}** a temps.`).catch(() => null);
      }
    }, ROUND_DURATION_MS);
  },
};

export default command;
