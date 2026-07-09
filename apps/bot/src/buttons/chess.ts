import type { ButtonHandler } from "../types.js";
import { chessGames } from "../lib/chess-store.js";
import { allLegalMoves, applyMove, isInCheck, opponentColor, parseSquare } from "../lib/chess.js";
import { bumpChessStat, buildChessEmbed, buildMoveButtonRows, endChessGame, turnStatusLine } from "../lib/chess-ui.js";

const handler: ButtonHandler = {
  prefix: "chess",
  async execute(interaction, parts) {
    const [channelId, action, a, b] = parts;
    const game = chessGames.get(channelId);
    if (!game?.active) {
      await interaction.reply({ content: "Cette partie n'existe plus. Relance `/echecs voir`.", ephemeral: true });
      return;
    }
    if (interaction.user.id !== game.players[game.turn]) {
      await interaction.reply({ content: "Ce n'est pas ton tour.", ephemeral: true });
      return;
    }

    if (action === "page") {
      const page = Number(a) || 0;
      await interaction.update({ embeds: [buildChessEmbed(game, turnStatusLine(game))], components: buildMoveButtonRows(game, page) });
      return;
    }

    // action === "move"
    const from = parseSquare(a);
    const to = parseSquare(b);
    const piece = from ? game.board[from.rank][from.file] : null;
    if (!from || !to || !piece || piece.color !== game.turn) {
      await interaction.reply({ content: "Selection invalide, relance `/echecs voir`.", ephemeral: true });
      return;
    }

    const possible = allLegalMoves(game.board, game.turn);
    const isLegal = possible.some((m) => m.from.file === from.file && m.from.rank === from.rank && m.to.file === to.file && m.to.rank === to.rank);
    if (!isLegal) {
      await interaction.reply({ content: "Coup illegal, relance `/echecs voir`.", ephemeral: true });
      return;
    }

    game.board = applyMove(game.board, from, to);
    game.moveCount += 1;
    const nextTurn = opponentColor(game.turn);
    game.turn = nextTurn;

    const inCheck = isInCheck(game.board, nextTurn);
    const hasMoves = allLegalMoves(game.board, nextTurn).length > 0;

    if (!hasMoves) {
      if (inCheck) {
        const winnerId = game.players[opponentColor(nextTurn)];
        await interaction.update({
          embeds: [buildChessEmbed(game, `Echec et mat ! <@${winnerId}> remporte la partie !`)],
          components: [],
        });
        await endChessGame(game, winnerId);
        return;
      }

      await interaction.update({ embeds: [buildChessEmbed(game, "Pat ! Partie nulle.")], components: [] });
      await bumpChessStat(game.guildId, game.players.w, "draws");
      await bumpChessStat(game.guildId, game.players.b, "draws");
      game.active = false;
      chessGames.delete(game.channelId);
      return;
    }

    const checkLine = inCheck ? " Echec !" : "";
    await interaction.update({
      embeds: [buildChessEmbed(game, `Au tour de <@${game.players[nextTurn]}> (${nextTurn === "w" ? "blancs" : "noirs"}).${checkLine}`)],
      components: buildMoveButtonRows(game),
    });
  },
};

export default handler;
