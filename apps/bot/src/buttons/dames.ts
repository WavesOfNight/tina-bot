import type { ButtonHandler } from "../types.js";
import { damesGames } from "../lib/dames-store.js";
import { applyCheckerMove, countPieces, hasAnyLegalMove, legalMovesForSquare, parseSquare, type CheckerColor } from "../lib/dames.js";
import { bumpDamesStat, buildDamesEmbed, buildFromButtonRows, buildToButtonRows, endDamesGame, turnStatusLine } from "../lib/dames-ui.js";

function opponentColor(color: CheckerColor): CheckerColor {
  return color === "w" ? "b" : "w";
}

const handler: ButtonHandler = {
  prefix: "dames",
  async execute(interaction, parts) {
    const [channelId, action, a, b] = parts;
    const game = damesGames.get(channelId);
    if (!game?.active) {
      await interaction.reply({ content: "Cette partie n'existe plus. Relance `/dames voir`.", ephemeral: true });
      return;
    }
    if (interaction.user.id !== game.players[game.turn]) {
      await interaction.reply({ content: "Ce n'est pas ton tour.", ephemeral: true });
      return;
    }

    if (action === "back") {
      await interaction.update({ embeds: [buildDamesEmbed(game, turnStatusLine(game))], components: buildFromButtonRows(game) });
      return;
    }

    if (action === "from") {
      const from = parseSquare(a);
      const piece = from ? game.board[from.rank][from.file] : null;
      if (!from || !piece || piece.color !== game.turn) {
        await interaction.reply({ content: "Selection invalide, relance `/dames voir`.", ephemeral: true });
        return;
      }

      const toRows = buildToButtonRows(game, from);
      if (toRows.length === 0) {
        await interaction.reply({ content: "Ce pion n'a plus de coup possible, relance `/dames voir`.", ephemeral: true });
        return;
      }

      await interaction.update({
        embeds: [buildDamesEmbed(game, `<@${interaction.user.id}>, choisis la destination pour ton pion en ${a}.`)],
        components: toRows,
      });
      return;
    }

    // action === "to"
    const from = parseSquare(a);
    const to = parseSquare(b);
    const piece = from ? game.board[from.rank][from.file] : null;
    if (!from || !to || !piece || piece.color !== game.turn) {
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

    await interaction.update({
      embeds: [buildDamesEmbed(game, turnStatusLine(game))],
      components: buildFromButtonRows(game),
    });
  },
};

export default handler;
