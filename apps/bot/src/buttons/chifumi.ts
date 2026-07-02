import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type TextChannel } from "discord.js";
import { prisma } from "@tina/database";
import type { ButtonHandler } from "../types.js";
import { chifumiDuels, chifumiEmoji, resolveChifumi, type ChifumiChoice } from "../lib/chifumi-store.js";
import { startChifumiRound } from "../commands/games/chifumi.js";
import { recordRoundResult, matchScoreLine, matches } from "../lib/match-store.js";

async function bumpStat(guildId: string, userId: string, field: "wins" | "losses" | "draws") {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "CHIFUMI" } },
    create: { guildId, userId, game: "CHIFUMI", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
}

const handler: ButtonHandler = {
  prefix: "chifumi",
  async execute(interaction, parts) {
    const [action, duelId, choice] = parts;
    const duel = chifumiDuels.get(duelId);

    if (!duel) {
      await interaction.reply({ content: "Ce duel n'existe plus.", ephemeral: true });
      return;
    }
    if (!duel.players.includes(interaction.user.id)) {
      await interaction.reply({ content: "Ce duel ne t'appartient pas.", ephemeral: true });
      return;
    }

    if (action === "open") {
      if (duel.choices[interaction.user.id]) {
        await interaction.reply({ content: "Tu as deja fait ton choix, en attente de ton adversaire...", ephemeral: true });
        return;
      }
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`chifumi:pick:${duelId}:pierre`).setLabel("Pierre").setEmoji("🪨").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`chifumi:pick:${duelId}:feuille`).setLabel("Feuille").setEmoji("📄").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`chifumi:pick:${duelId}:ciseaux`).setLabel("Ciseaux").setEmoji("✂️").setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({ content: "Fais ton choix :", components: [row], ephemeral: true });
      return;
    }

    if (action === "pick") {
      duel.choices[interaction.user.id] = choice as ChifumiChoice;
      await interaction.update({ content: `Tu as choisi ${chifumiEmoji(choice as ChifumiChoice)} ! En attente de l'adversaire...`, components: [] });

      const [p1, p2] = duel.players;
      const choiceA = duel.choices[p1];
      const choiceB = duel.choices[p2];
      if (!choiceA || !choiceB) return;

      chifumiDuels.delete(duelId);
      const result = resolveChifumi(choiceA, choiceB);
      const isDraw = result === "draw";
      const roundWinnerIndex = isDraw ? null : result === "a" ? 0 : 1;

      const channel = await interaction.client.channels.fetch(duel.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;
      const message = await channel.messages.fetch(duel.messageId).catch(() => null);

      let resultLine: string;
      if (isDraw) {
        resultLine = "Egalite !";
        await bumpStat(duel.guildId, p1, "draws");
        await bumpStat(duel.guildId, p2, "draws");
      } else {
        const winnerId = duel.players[roundWinnerIndex as 0 | 1];
        const loserId = duel.players[roundWinnerIndex === 0 ? 1 : 0];
        resultLine = `<@${winnerId}> gagne !`;
        await bumpStat(duel.guildId, winnerId, "wins");
        await bumpStat(duel.guildId, loserId, "losses");
      }

      const duelSummary = `<@${p1}> ${chifumiEmoji(choiceA)} contre ${chifumiEmoji(choiceB)} <@${p2}>\n${resultLine}`;

      if (duel.matchId) {
        const outcome = recordRoundResult(duel.matchId, roundWinnerIndex);
        if (outcome) {
          if (outcome.finished) {
            const winnerId = outcome.matchWinnerIndex !== null ? duel.players[outcome.matchWinnerIndex] : null;
            await message?.edit(`${duelSummary}\n${matchScoreLine(outcome.match)}\n\n🏆 <@${winnerId}> remporte le match !`).catch(() => null);
            return;
          }

          await message?.edit(`${duelSummary}\n${matchScoreLine(outcome.match)}\nProchaine manche dans quelques secondes...`).catch(() => null);
          const nextRound = matches.get(duel.matchId) ?? outcome.match;
          setTimeout(() => {
            startChifumiRound(channel as TextChannel, duel.players, duel.guildId, duel.matchId, ` (manche ${nextRound.round}/${nextRound.roundsToWin * 2 - 1})`).catch(() => null);
          }, 3_000);
          return;
        }
      }

      await message?.edit(duelSummary).catch(() => null);
    }
  },
};

export default handler;
