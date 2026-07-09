import type { SelectMenuHandler } from "../types.js";
import { damesGames } from "../lib/dames-store.js";
import { applyCheckerMove, countPieces, hasAnyLegalMove, legalMovesForSquare, parseSquare, type CheckerColor } from "../lib/dames.js";
import { buildDamesEmbed, buildFromSelectRow, buildToSelectRow, endDamesGame, turnStatusLine } from "../lib/dames-ui.js";

function opponentColor(color: CheckerColor): CheckerColor {
  return color === "w" ? "b" : "w";
}

const handler: SelectMenuHandler = {
  prefix: "dames",
  async execute(interaction, parts) {
    const [channelId, step, fromSquareStr] = parts;
    const game = damesGames.get(channelId);
    if (!game?.active) {
      await interaction.reply({ content: "Cette partie n'existe plus. Relance `/dames voir`.", ephemeral: true });
      return;
    }
    if (interaction.user.id !== game.players[game.turn]) {
      await interaction.reply({ content: "Ce n'est pas ton tour.", ephemeral: true });
      return;
    }

    if (step === "from") {
      const from = parseSquare(interaction.values[0]);
      const piece = from ? game.board[from.rank][from.file] : null;
      if (!from || !piece || piece.color !== game.turn) {
        await interaction.reply({ content: "Selection invalide, relance `/dames voir`.", ephemeral: true });
        return;
      }

      const toRow = buildToSelectRow(game, from);
      if (!toRow) {
        await interaction.reply({ content: "Ce pion n'a plus de coup possible, relance `/dames voir`.", ephemeral: true });
        return;
      }

      await interaction.update({
        embeds: [buildDamesEmbed(game, `<@${interaction.user.id}>, choisis la destination pour ton pion en ${interaction.values[0]}.`)],
        components: [toRow],
      });
      return;
    }

    // step === "to"
    const from = parseSquare(fromSquareStr);
    if (!from) {
      await interaction.reply({ content: "Selection invalide, relance `/dames voir`.", ephemeral: true });
      return;
    }

    if (interaction.values[0] === "__back__") {
      const fromRow = buildFromSelectRow(game);
      if (!fromRow) {
        await interaction.reply({ content: "Aucun coup possible, relance `/dames voir`.", ephemeral: true });
        return;
      }
      await interaction.update({ embeds: [buildDamesEmbed(game, turnStatusLine(game))], components: [fromRow] });
      return;
    }

    const to = parseSquare(interaction.values[0]);
    const piece = game.board[from.rank][from.file];
    if (!to || !piece || piece.color !== game.turn) {
      await interaction.reply({ content: "Selection invalide, relance `/dames voir`.", ephemeral: true });
      return;
    }

    const possible = legalMovesForSquare(game.board, from);
    const chosen = possible.find((m) => m.to.file === to.file && m.to.rank === to.rank);
    if (!chosen) {
      await interaction.reply({ content: "Coup illegal, relance `/dames voir`.", ephemeral: true });
      return;
    }

    game.board = applyCheckerMove(game.board, from, chosen);
    const nextTurn = opponentColor(game.turn);
    game.turn = nextTurn;

    const opponentPieces = countPieces(game.board, nextTurn);
    if (opponentPieces === 0 || !hasAnyLegalMove(game.board, nextTurn)) {
      const winnerId = game.players[opponentColor(nextTurn)];
      await interaction.update({
        embeds: [buildDamesEmbed(game, `<@${winnerId}> remporte la partie !`)],
        components: [],
      });
      await endDamesGame(game, winnerId);
      return;
    }

    const fromRow = buildFromSelectRow(game);
    await interaction.update({
      embeds: [buildDamesEmbed(game, turnStatusLine(game))],
      components: fromRow ? [fromRow] : [],
    });
  },
};

export default handler;
