import { EmbedBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { ButtonHandler } from "../types.js";
import { triviaRounds } from "../lib/trivia-store.js";
import { buildTriviaComponents } from "../commands/games/trivia.js";

const LETTERS = ["A", "B", "C", "D"] as const;

const handler: ButtonHandler = {
  prefix: "trivia",
  async execute(interaction, parts) {
    const [roundId, indexStr] = parts;
    const round = triviaRounds.get(roundId);

    if (!round) {
      await interaction.reply({ content: "Ce quiz est deja termine.", ephemeral: true });
      return;
    }
    if (round.answered) {
      await interaction.reply({ content: "Quelqu'un a deja trouve la bonne reponse !", ephemeral: true });
      return;
    }

    const chosenIndex = Number(indexStr);
    if (chosenIndex !== round.question.correctIndex) {
      await interaction.reply({ content: "Mauvaise reponse, retente ta chance sur le prochain quiz !", ephemeral: true });
      return;
    }

    round.answered = true;
    triviaRounds.delete(roundId);

    await prisma.guild.upsert({ where: { id: round.guildId }, create: { id: round.guildId }, update: {} });
    await prisma.gameStat.upsert({
      where: { guildId_userId_game: { guildId: round.guildId, userId: interaction.user.id, game: "TRIVIA" } },
      create: { guildId: round.guildId, userId: interaction.user.id, game: "TRIVIA", plays: 1, wins: 1 },
      update: { plays: { increment: 1 }, wins: { increment: 1 } },
    });

    const embed = new EmbedBuilder()
      .setColor(0x639922)
      .setTitle(`Quiz - ${round.question.category}`)
      .setDescription(round.question.question)
      .addFields(round.question.choices.map((choice, index) => ({ name: LETTERS[index], value: choice, inline: true })))
      .setFooter({ text: `${interaction.user.username} a trouve la bonne reponse en premier !` });

    await interaction.update({ embeds: [embed], components: buildTriviaComponents(roundId, true) });
  },
};

export default handler;
