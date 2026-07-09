import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { ChessGame } from "./chess-store.js";
import { chessGames } from "./chess-store.js";
import { isInCheck, legalMoves, renderBoard, squareLabel, type PieceColor, type PieceType, type Square } from "./chess.js";

const PIECE_EMOJI: Record<PieceColor, Record<PieceType, string>> = {
  w: { P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔" },
  b: { P: "♟", N: "♞", B: "♝", R: "♜", Q: "♛", K: "♚" },
};

function chunkRows(buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  }
  return rows.slice(0, 5);
}

export function buildChessEmbed(game: ChessGame, statusLine: string) {
  return new EmbedBuilder()
    .setColor(0x7f77dd)
    .setTitle("♟️ Echecs")
    .setDescription(`${renderBoard(game.board)}\n\n${statusLine}`)
    .addFields(
      { name: "Blancs", value: `<@${game.players.w}>`, inline: true },
      { name: "Noirs", value: `<@${game.players.b}>`, inline: true },
    )
    .setFooter({ text: "Clique sur une piece, puis sur sa destination." });
}

export function turnStatusLine(game: ChessGame): string {
  const check = isInCheck(game.board, game.turn) ? " Echec !" : "";
  return `Au tour de <@${game.players[game.turn]}> (${game.turn === "w" ? "blancs" : "noirs"}).${check}`;
}

export function buildFromButtonRows(game: ChessGame): ActionRowBuilder<ButtonBuilder>[] {
  const buttons: ButtonBuilder[] = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = game.board[rank][file];
      if (!piece || piece.color !== game.turn) continue;
      const from: Square = { file, rank };
      if (legalMoves(game.board, from).length === 0) continue;
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`chess:${game.channelId}:from:${squareLabel(from)}`)
          .setLabel(`${PIECE_EMOJI[piece.color][piece.type]} ${squareLabel(from)}`)
          .setStyle(ButtonStyle.Secondary),
      );
    }
  }
  return chunkRows(buttons.slice(0, 25));
}

export function buildToButtonRows(game: ChessGame, from: Square): ActionRowBuilder<ButtonBuilder>[] {
  const moves = legalMoves(game.board, from);
  if (moves.length === 0) return [];

  const buttons = moves.slice(0, 24).map((to) => {
    const captured = game.board[to.rank][to.file];
    return new ButtonBuilder()
      .setCustomId(`chess:${game.channelId}:to:${squareLabel(from)}:${squareLabel(to)}`)
      .setLabel(captured ? `${squareLabel(to)} ⚔️` : squareLabel(to))
      .setStyle(captured ? ButtonStyle.Danger : ButtonStyle.Primary);
  });
  buttons.push(
    new ButtonBuilder()
      .setCustomId(`chess:${game.channelId}:back`)
      .setLabel("↩️ Changer de piece")
      .setStyle(ButtonStyle.Secondary),
  );
  return chunkRows(buttons);
}

export async function bumpChessStat(guildId: string, userId: string, field: "wins" | "losses" | "draws") {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "ECHECS" } },
    create: { guildId, userId, game: "ECHECS", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
}

export async function endChessGame(game: ChessGame, winnerId: string | null) {
  game.active = false;
  chessGames.delete(game.channelId);
  if (!winnerId) return;

  const loserId = winnerId === game.players.w ? game.players.b : game.players.w;
  await bumpChessStat(game.guildId, winnerId, "wins");
  await bumpChessStat(game.guildId, loserId, "losses");
}
