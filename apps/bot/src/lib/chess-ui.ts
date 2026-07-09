import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { ChessGame } from "./chess-store.js";
import { chessGames } from "./chess-store.js";
import { allLegalMoves, isInCheck, renderBoard, squareLabel, type PieceColor, type PieceType, type Square } from "./chess.js";

const PIECE_EMOJI: Record<PieceColor, Record<PieceType, string>> = {
  w: { P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔" },
  b: { P: "♟", N: "♞", B: "♝", R: "♜", Q: "♛", K: "♚" },
};

const SINGLE_PAGE_MAX = 24;
const PAGE_SIZE = 20;

function chunkRows(buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

function sortMoves(moves: { from: Square; to: Square }[]) {
  return [...moves].sort(
    (a, b) => a.from.rank - b.from.rank || a.from.file - b.from.file || a.to.rank - b.to.rank || a.to.file - b.to.file,
  );
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
    .setFooter({ text: "Clique directement sur le coup que tu veux jouer." });
}

export function turnStatusLine(game: ChessGame): string {
  const check = isInCheck(game.board, game.turn) ? " Echec !" : "";
  return `Au tour de <@${game.players[game.turn]}> (${game.turn === "w" ? "blancs" : "noirs"}).${check}`;
}

export function buildMoveButtonRows(game: ChessGame, page = 0): ActionRowBuilder<ButtonBuilder>[] {
  const moves = sortMoves(allLegalMoves(game.board, game.turn));
  if (moves.length === 0) return [];

  const toButton = (m: { from: Square; to: Square }) => {
    const piece = game.board[m.from.rank][m.from.file]!;
    const captured = game.board[m.to.rank][m.to.file];
    return new ButtonBuilder()
      .setCustomId(`chess:${game.channelId}:move:${squareLabel(m.from)}:${squareLabel(m.to)}`)
      .setLabel(`${PIECE_EMOJI[piece.color][piece.type]} ${squareLabel(m.from)}→${squareLabel(m.to)}${captured ? " ⚔️" : ""}`)
      .setStyle(captured ? ButtonStyle.Danger : ButtonStyle.Primary);
  };

  if (moves.length <= SINGLE_PAGE_MAX) {
    return chunkRows(moves.map(toButton));
  }

  const totalPages = Math.ceil(moves.length / PAGE_SIZE);
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
  const pageMoves = moves.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);
  const rows = chunkRows(pageMoves.map(toButton));

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`chess:${game.channelId}:page:${clampedPage - 1}`)
        .setLabel("◀️ Precedent")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage === 0),
      new ButtonBuilder()
        .setCustomId(`chess:${game.channelId}:page:${clampedPage}`)
        .setLabel(`Page ${clampedPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`chess:${game.channelId}:page:${clampedPage + 1}`)
        .setLabel("Suivant ▶️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage >= totalPages - 1),
    ),
  );

  return rows;
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
