import type { SelectMenuHandler } from "../types.js";
import { chessGames } from "../lib/chess-store.js";
import { allLegalMoves, applyMove, isInCheck, legalMoves, opponentColor, parseSquare } from "../lib/chess.js";
import { bumpChessStat, buildChessEmbed, buildFromSelectRow, buildToSelectRow, endChessGame, turnStatusLine } from "../lib/chess-ui.js";

const handler: SelectMenuHandler = {
  prefix: "chess",
  async execute(interaction, parts) {
    const [channelId, step, fromSquareStr] = parts;
    const game = chessGames.get(channelId);
    if (!game?.active) {
      await interaction.reply({ content: "Cette partie n'existe plus. Relance `/echecs voir`.", ephemeral: true });
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
        await interaction.reply({ content: "Selection invalide, relance `/echecs voir`.", ephemeral: true });
        return;
      }

      const toRow = buildToSelectRow(game, from);
      if (!toRow) {
        await interaction.reply({ content: "Cette piece n'a plus de coup possible, relance `/echecs voir`.", ephemeral: true });
        return;
      }

      await interaction.update({
        embeds: [buildChessEmbed(game, `<@${interaction.user.id}>, choisis la destination pour ta piece en ${interaction.values[0]}.`)],
        components: [toRow],
      });
      return;
    }

    // step === "to"
    const from = parseSquare(fromSquareStr);
    if (!from) {
      await interaction.reply({ content: "Selection invalide, relance `/echecs voir`.", ephemeral: true });
      return;
    }

    if (interaction.values[0] === "__back__") {
      const fromRow = buildFromSelectRow(game);
      if (!fromRow) {
        await interaction.reply({ content: "Aucun coup possible, relance `/echecs voir`.", ephemeral: true });
        return;
      }
      await interaction.update({ embeds: [buildChessEmbed(game, turnStatusLine(game))], components: [fromRow] });
      return;
    }

    const to = parseSquare(interaction.values[0]);
    const piece = game.board[from.rank][from.file];
    if (!to || !piece || piece.color !== game.turn) {
      await interaction.reply({ content: "Selection invalide, relance `/echecs voir`.", ephemeral: true });
      return;
    }

    const possible = legalMoves(game.board, from);
    if (!possible.some((m) => m.file === to.file && m.rank === to.rank)) {
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
    const fromRow = buildFromSelectRow(game);
    await interaction.update({
      embeds: [buildChessEmbed(game, `Au tour de <@${game.players[nextTurn]}> (${nextTurn === "w" ? "blancs" : "noirs"}).${checkLine}`)],
      components: fromRow ? [fromRow] : [],
    });
  },
};

export default handler;
