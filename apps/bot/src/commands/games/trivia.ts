import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { TRIVIA_QUESTIONS } from "../../lib/trivia-questions.js";
import { triviaRounds } from "../../lib/trivia-store.js";

const LETTERS = ["A", "B", "C", "D"] as const;

export function buildTriviaComponents(roundId: string, disabled = false) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  LETTERS.forEach((letter, index) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`trivia:${roundId}:${index}`)
        .setLabel(letter)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
    );
  });
  return [row];
}

const command: Command = {
  data: new SlashCommandBuilder().setName("trivia").setDescription("Lance une question de quiz pour tout le salon"),
  async execute(interaction) {
    const question = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];

    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle(`Quiz - ${question.category}`)
      .setDescription(question.question)
      .addFields(question.choices.map((choice, index) => ({ name: LETTERS[index], value: choice, inline: true })))
      .setFooter({ text: "Clique sur la bonne reponse !" });

    const reply = await interaction.reply({ embeds: [embed], components: buildTriviaComponents("pending"), fetchReply: true });
    const roundId = reply.id;
    triviaRounds.set(roundId, { question, guildId: interaction.guildId!, answered: false });

    await interaction.editReply({ components: buildTriviaComponents(roundId) });

    setTimeout(async () => {
      const round = triviaRounds.get(roundId);
      if (round && !round.answered) {
        triviaRounds.delete(roundId);
        const correctText = question.choices[question.correctIndex];
        await interaction
          .editReply({
            embeds: [embed.setFooter({ text: `Temps ecoule ! La bonne reponse etait : ${correctText}` })],
            components: buildTriviaComponents(roundId, true),
          })
          .catch(() => null);
      }
    }, 30_000);
  },
};

export default command;
