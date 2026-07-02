import type { TextChannel } from "discord.js";
import { prisma } from "@tina/database";
import type { ButtonHandler } from "../types.js";
import { checkConnect4Winner, connect4Games, dropPiece, isBoardFull, renderBoard } from "../lib/connect4-store.js";
import { buildColumnButtons, startConnect4Round } from "../commands/games/puissance4.js";
import { recordRoundResult, matchScoreLine, matches } from "../lib/match-store.js";

async function bumpStat(guildId: string, userId: string, field: "wins" | "losses" | "draws") {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "CONNECT4" } },
    create: { guildId, userId, game: "CONNECT4", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
}

async function startNextRound(channel: TextChannel, players: [string, string], guildId: string, matchId: string) {
  const match = matches.get(matchId);
  const roundLabel = match ? ` (manche ${match.round}/${match.roundsToWin * 2 - 1})` : "";
  const round = startConnect4Round(players, guildId, matchId);

  const message = await channel.send({
    content: `Puissance 4 : <@${players[0]}> (🔴) contre <@${players[1]}> (🟡)${roundLabel}\n\n${renderBoard(round.board)}\n\nA <@${players[0]}> de jouer !`,
    components: buildColumnButtons("pending", round.board),
  });

  connect4Games.set(message.id, round);
  await message
    .edit({ components: buildColumnButtons(message.id, round.board) })
    .catch(() => null);
}

const handler: ButtonHandler = {
  prefix: "puissance4",
  async execute(interaction, parts) {
    const [gameId, colStr] = parts;
    const game = connect4Games.get(gameId);

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

    const col = Number(colStr);
    const row = dropPiece(game.board, col, playerIndex as 0 | 1);
    if (row === null) {
      await interaction.reply({ content: "Cette colonne est pleine.", ephemeral: true });
      return;
    }

    const won = checkConnect4Winner(game.board, row, col);
    const [p1, p2] = game.players;
    const isDraw = !won && isBoardFull(game.board);

    if (won || isDraw) {
      connect4Games.delete(gameId);
      const roundWinnerIndex = won ? (playerIndex as 0 | 1) : null;

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
              content: `${isDraw ? "Match nul sur cette manche." : `Manche pour <@${game.players[roundWinnerIndex as 0 | 1]}> !`}\n${renderBoard(game.board)}\n${matchScoreLine(outcome.match)}\n\n🏆 <@${winnerId}> remporte le match !`,
              components: buildColumnButtons(gameId, game.board, true),
            });
            return;
          }

          await interaction.update({
            content: `${isDraw ? "Match nul sur cette manche." : `Manche pour <@${game.players[roundWinnerIndex as 0 | 1]}> !`}\n${renderBoard(game.board)}\n${matchScoreLine(outcome.match)}\nProchaine manche dans quelques secondes...`,
            components: buildColumnButtons(gameId, game.board, true),
          });

          setTimeout(() => {
            startNextRound(interaction.channel as TextChannel, game.players, game.guildId, game.matchId!).catch(() => null);
          }, 3_000);
          return;
        }
      }

      await interaction.update({
        content: isDraw
          ? `Puissance 4 : <@${p1}> (🔴) contre <@${p2}> (🟡)\n\n${renderBoard(game.board)}\n\nMatch nul !`
          : `Puissance 4 : <@${p1}> (🔴) contre <@${p2}> (🟡)\n\n${renderBoard(game.board)}\n\nVictoire de <@${game.players[roundWinnerIndex as 0 | 1]}> !`,
        components: buildColumnButtons(gameId, game.board, true),
      });
      return;
    }

    game.turn = game.turn === 0 ? 1 : 0;
    const nextPlayerId = game.players[game.turn];

    await interaction.update({
      content: `Puissance 4 : <@${p1}> (🔴) contre <@${p2}> (🟡)\n\n${renderBoard(game.board)}\n\nA <@${nextPlayerId}> de jouer !`,
      components: buildColumnButtons(gameId, game.board),
    });
  },
};

export default handler;
