import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { hangmanStage, maskedWord, penduRounds, type PenduRound } from "../../lib/pendu-store.js";
import { pickPenduWord } from "../../lib/pendu-words.js";

const ROUND_DURATION_MS = 180_000;
const MAX_WRONG = 6;

export function buildPenduEmbed(round: PenduRound, footer: string) {
  const guessed = [...round.guessedLetters].sort().join(", ") || "aucune";
  return new EmbedBuilder()
    .setColor(0x7f77dd)
    .setTitle(`🎪 Pendu - ${round.category}`)
    .setDescription(`${hangmanStage(round.wrongGuesses)}\n**Mot :** \`${maskedWord(round)}\``)
    .addFields(
      { name: "Lettres essayees", value: guessed, inline: true },
      { name: "Erreurs", value: `${round.wrongGuesses}/${round.maxWrong}`, inline: true },
    )
    .setFooter({ text: footer });
}

const command: Command = {
  data: new SlashCommandBuilder().setName("pendu").setDescription("Lance une partie de pendu dans ce salon"),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.channelId) return;

    if (penduRounds.get(interaction.channelId)?.active) {
      await interaction.reply({ content: "Une partie de pendu est deja en cours dans ce salon !", ephemeral: true });
      return;
    }

    const picked = pickPenduWord();
    const round: PenduRound = {
      word: picked.word,
      category: picked.category,
      guessedLetters: new Set(),
      wrongGuesses: 0,
      maxWrong: MAX_WRONG,
      guildId: interaction.guildId,
      messageId: "pending",
      active: true,
    };

    const embed = buildPenduEmbed(round, "Tape une lettre ou le mot complet dans le chat !");
    const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
    round.messageId = reply.id;
    penduRounds.set(interaction.channelId, round);

    setTimeout(async () => {
      const current = penduRounds.get(interaction.channelId!);
      if (current?.active && current.messageId === reply.id) {
        current.active = false;
        penduRounds.delete(interaction.channelId!);
        await interaction
          .editReply({ embeds: [buildPenduEmbed(current, `Temps ecoule ! Le mot etait : ${current.word}`)] })
          .catch(() => null);
      }
    }, ROUND_DURATION_MS);
  },
};

export default command;
