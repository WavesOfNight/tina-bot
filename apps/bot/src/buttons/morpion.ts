import type { TextChannel } from "discord.js";
import { prisma } from "@tina/database";
import type { ButtonHandler } from "../types.js";
import { morpionGames, checkWinner } from "../lib/morpion-store.js";
import { buildBoardRows, startMorpionRound } from "../commands/games/morpion.js";
import { recordRoundResult, matchScoreLine, matches } from "../lib/match-store.js";

async function bumpStat(guildId: string, userId: string, field: "wins" | "losses" | "draws") {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "MORPION" } },
    create: { guildId, userId, game: "MORPION", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
}

async function startNextRound(channel: TextChannel, players: [string, string], guildId: string, matchId: string) {
  const match = matches.get(matchId);
  const roundLabel = match ? ` (manche ${match.round}/${match.roundsToWin * 2 - 1})` : "";
  const round = startMorpionRound(players, guildId, matchId);

  const message = await channel.send({
    content: `Morpion : <@${players[0]}> (X) contre <@${players[1]}> (O)${roundLabel}. A <@${players[0]}> de jouer !`,
    components: buildBoardRows("pending", round.board),
  });

  morpionGames.set(message.id, round);
  await message.edit({ components: buildBoardRows(message.id, round.board) }).catch(() => null);
}

const handler: ButtonHandler = {
  prefix: "morpion",
  async execute(interaction, parts) {
    const [gameId, indexStr] = parts;
    const game = morpionGames.get(gameId);

    if (!game) {
      await interaction.reply({ content: "Cette partie n'existe plus.", ephemeral: true });
      return;
    }

    const playerIndex = game.players.indexOf(interaction.user.id);
    if (playerIndex === -1) {
      await interaction.reply({ content: "Cette partie ne t'appartient pas.", ephemeral: true });
      return;
    }
    if (playerIndex !== game.turn) {
      await interaction.reply({ content: "Ce n'est pas ton tour.", ephemeral: true });
      return;
    }

    const index = Number(indexStr);
    if (game.board[index] !== null) {
      await interaction.reply({ content: "Cette case est deja prise.", ephemeral: true });
      return;
    }

    game.board[index] = playerIndex === 0 ? "X" : "O";
    const result = checkWinner(game.board);

    if (result) {
      morpionGames.delete(gameId);
      const [p1, p2] = game.players;
      const isDraw = result === "draw";
      const roundWinnerIndex = isDraw ? null : result === "X" ? 0 : 1;

      if (isDraw) {
        await bumpStat(game.guildId, p1, "draws");
        await bumpStat(game.guildId, p2, "draws");
      } else {
        const winnerId = game.players[roundWinnerIndex as 0 | 1];
        const loserId = game.players[roundWinnerIndex === 0 ? 1 : 0];
        await bumpStat(game.guildId, winnerId, "wins");
        await bumpStat(game.guildId, loserId, "losses");
      }

      if (game.matchId) {
        const outcome = recordRoundResult(game.matchId, roundWinnerIndex);
        if (outcome) {
          if (outcome.finished) {
            const winnerId = outcome.matchWinnerIndex !== null ? game.players[outcome.matchWinnerIndex] : null;
            await interaction.update({
              content: `${isDraw ? "Match nul sur cette manche." : `Manche pour <@${game.players[roundWinnerIndex as 0 | 1]}> !`}\n${matchScoreLine(outcome.match)}\n\n🏆 <@${winnerId}> remporte le match !`,
              components: buildBoardRows(gameId, game.board, true),
            });
            return;
          }

          await interaction.update({
            content: `${isDraw ? "Match nul sur cette manche." : `Manche pour <@${game.players[roundWinnerIndex as 0 | 1]}> !`}\n${matchScoreLine(outcome.match)}\nProchaine manche dans quelques secondes...`,
            components: buildBoardRows(gameId, game.board, true),
          });

          setTimeout(() => {
            startNextRound(interaction.channel as TextChannel, game.players, game.guildId, game.matchId!).catch(() => null);
          }, 3_000);
          return;
        }
      }

      await interaction.update({
        content: isDraw ? `Match nul entre <@${p1}> et <@${p2}> !` : `Victoire de <@${game.players[roundWinnerIndex as 0 | 1]}> !`,
        components: buildBoardRows(gameId, game.board, true),
      });
      return;
    }

    game.turn = game.turn === 0 ? 1 : 0;
    const nextPlayerId = game.players[game.turn];

    await interaction.update({
      content: `Morpion : <@${game.players[0]}> (X) contre <@${game.players[1]}> (O). A <@${nextPlayerId}> de jouer !`,
      components: buildBoardRows(gameId, game.board),
    });
  },
};

export default handler;
