import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { ChessGame } from "./chess-store.js";
import { chessGames } from "./chess-store.js";
import { isInCheck, legalMoves, renderBoard, squareLabel, type PieceType, type Square } from "./chess.js";

const PIECE_NAMES: Record<PieceType, string> = {
  P: "Pion",
  N: "Cavalier",
  B: "Fou",
  R: "Tour",
  Q: "Dame",
  K: "Roi",
};

export function buildChessEmbed(game: ChessGame, statusLine: string) {
  return new EmbedBuilder()
    .setColor(0x7f77dd)
    .setTitle("♟️ Echecs")
    .setDescription(`\`\`\`\n${renderBoard(game.board)}\n\`\`\`\n${statusLine}`)
    .addFields(
      { name: "Blancs", value: `<@${game.players.w}>`, inline: true },
      { name: "Noirs", value: `<@${game.players.b}>`, inline: true },
    )
    .setFooter({ text: "Choisis une piece, puis sa destination dans les menus ci-dessous." });
}

export function turnStatusLine(game: ChessGame): string {
  const check = isInCheck(game.board, game.turn) ? " Echec !" : "";
  return `Au tour de <@${game.players[game.turn]}> (${game.turn === "w" ? "blancs" : "noirs"}).${check}`;
}

export function buildFromSelectRow(game: ChessGame): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const options: { label: string; value: string }[] = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = game.board[rank][file];
      if (!piece || piece.color !== game.turn) continue;
      const from: Square = { file, rank };
      if (legalMoves(game.board, from).length === 0) continue;
      options.push({ label: `${PIECE_NAMES[piece.type]} en ${squareLabel(from)}`, value: squareLabel(from) });
    }
  }
  if (options.length === 0) return null;

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`chess:${game.channelId}:from`)
    .setPlaceholder("Choisis une piece a deplacer")
    .addOptions(options.slice(0, 25));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export function buildToSelectRow(game: ChessGame, from: Square): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const moves = legalMoves(game.board, from);
  if (moves.length === 0) return null;

  const options = moves.slice(0, 24).map((to) => {
    const captured = game.board[to.rank][to.file];
    return { label: captured ? `${squareLabel(to)} (prise !)` : squareLabel(to), value: squareLabel(to) };
  });
  options.push({ label: "Changer de piece", value: "__back__" });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`chess:${game.channelId}:to:${squareLabel(from)}`)
    .setPlaceholder(`Destination pour ta piece en ${squareLabel(from)}`)
    .addOptions(options);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
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
