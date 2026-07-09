import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { DamesGame } from "./dames-store.js";
import { damesGames } from "./dames-store.js";
import { allLegalMoves, renderCheckerBoard, squareLabel, type CheckerMove, type Square } from "./dames.js";

const SINGLE_PAGE_MAX = 24;
const PAGE_SIZE = 20;

function chunkRows(buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

function sortMoves(moves: { from: Square; move: CheckerMove }[]) {
  return [...moves].sort(
    (a, b) => a.from.rank - b.from.rank || a.from.file - b.from.file || a.move.to.rank - b.move.to.rank || a.move.to.file - b.move.to.file,
  );
}

export function buildDamesEmbed(game: DamesGame, statusLine: string) {
  return new EmbedBuilder()
    .setColor(0x9fe1cb)
    .setTitle("⛃ Dames")
    .setDescription(`${renderCheckerBoard(game.board)}\n\n${statusLine}`)
    .addFields(
      { name: "Blancs (w)", value: `<@${game.players.w}>`, inline: true },
      { name: "Noirs (b)", value: `<@${game.players.b}>`, inline: true },
    )
    .setFooter({ text: "Clique directement sur le coup que tu veux jouer." });
}

export function turnStatusLine(game: DamesGame): string {
  return `Au tour de <@${game.players[game.turn]}> (${game.turn === "w" ? "blancs" : "noirs"}).`;
}

export function buildMoveButtonRows(game: DamesGame, page = 0): ActionRowBuilder<ButtonBuilder>[] {
  const moves = sortMoves(allLegalMoves(game.board, game.turn));
  if (moves.length === 0) return [];

  const toButton = (m: { from: Square; move: CheckerMove }) => {
    const piece = game.board[m.from.rank][m.from.file]!;
    const pieceEmoji = piece.king ? (piece.color === "w" ? "🟠" : "🟣") : piece.color === "w" ? "⚪" : "⚫";
    return new ButtonBuilder()
      .setCustomId(`dames:${game.channelId}:move:${squareLabel(m.from)}:${squareLabel(m.move.to)}`)
      .setLabel(`${pieceEmoji} ${squareLabel(m.from)}→${squareLabel(m.move.to)}${m.move.captured ? " ⚔️" : ""}`)
      .setStyle(m.move.captured ? ButtonStyle.Danger : ButtonStyle.Primary);
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
        .setCustomId(`dames:${game.channelId}:page:${clampedPage - 1}`)
        .setLabel("◀️ Precedent")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage === 0),
      new ButtonBuilder()
        .setCustomId(`dames:${game.channelId}:page:${clampedPage}`)
        .setLabel(`Page ${clampedPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`dames:${game.channelId}:page:${clampedPage + 1}`)
        .setLabel("Suivant ▶️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage >= totalPages - 1),
    ),
  );

  return rows;
}

export async function bumpDamesStat(guildId: string, userId: string, field: "wins" | "losses" | "draws") {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "DAMES" } },
    create: { guildId, userId, game: "DAMES", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
}

export async function endDamesGame(game: DamesGame, winnerId: string | null) {
  game.active = false;
  damesGames.delete(game.channelId);
  if (!winnerId) return;

  const loserId = winnerId === game.players.w ? game.players.b : game.players.w;
  await bumpDamesStat(game.guildId, winnerId, "wins");
  await bumpDamesStat(game.guildId, loserId, "losses");
}
