import { prisma } from "@tina/database";
import type { ButtonHandler } from "../types.js";
import { checkConnect4Winner, connect4Games, dropPiece, isBoardFull, renderBoard } from "../lib/connect4-store.js";
import { buildColumnButtons } from "../commands/games/puissance4.js";

async function bumpStat(guildId: string, userId: string, field: "wins" | "losses" | "draws") {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "CONNECT4" } },
    create: { guildId, userId, game: "CONNECT4", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
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

    if (won) {
      connect4Games.delete(gameId);
      const winnerId = game.players[playerIndex];
      const loserId = game.players[playerIndex === 0 ? 1 : 0];
      await bumpStat(game.guildId, winnerId, "wins");
      await bumpStat(game.guildId, loserId, "losses");

      await interaction.update({
        content: `Puissance 4 : ${`<@${p1}>`} (🔴) contre ${`<@${p2}>`} (🟡)\n\n${renderBoard(game.board)}\n\nVictoire de <@${winnerId}> !`,
        components: buildColumnButtons(gameId, game.board, true),
      });
      return;
    }

    if (isBoardFull(game.board)) {
      connect4Games.delete(gameId);
      await bumpStat(game.guildId, p1, "draws");
      await bumpStat(game.guildId, p2, "draws");

      await interaction.update({
        content: `Puissance 4 : ${`<@${p1}>`} (🔴) contre ${`<@${p2}>`} (🟡)\n\n${renderBoard(game.board)}\n\nMatch nul !`,
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
