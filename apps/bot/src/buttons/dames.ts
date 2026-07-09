import type { ButtonHandler } from "../types.js";
import { damesGames } from "../lib/dames-store.js";
import { allLegalMoves, applyCheckerMove, countPieces, hasAnyLegalMove, parseSquare, type CheckerColor } from "../lib/dames.js";
import { bumpDamesStat, buildDamesEmbed, buildMoveButtonRows, endDamesGame, turnStatusLine } from "../lib/dames-ui.js";

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

    if (action === "page") {
      const page = Number(a) || 0;
      await interaction.update({ embeds: [buildDamesEmbed(game, turnStatusLine(game))], components: buildMoveButtonRows(game, page) });
      return;
    }

    // action === "move"
    const from = parseSquare(a);
    const to = parseSquare(b);
    const piece = from ? game.board[from.rank][from.file] : null;
    if (!from || !to || !piece || piece.color !== game.turn) {
      await interaction.reply({ content: "Selection invalide, relance `/dames voir`.", ephemeral: true });
      return;
    }

    const possible = allLegalMoves(game.board, game.turn);
    const chosen = possible.find(
      (m) => m.from.file === from.file && m.from.rank === from.rank && m.move.to.file === to.file && m.move.to.rank === to.rank,
    );
    if (!chosen) {
      await interaction.reply({ content: "Coup illegal, relance `/dames voir`.", ephemeral: true });
      return;
    }

    game.board = applyCheckerMove(game.board, from, chosen.move);
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
      components: buildMoveButtonRows(game),
    });
  },
};

export default handler;
