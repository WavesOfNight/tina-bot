import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { DamesGame } from "./dames-store.js";
import { damesGames } from "./dames-store.js";
import { legalMovesForSquare, renderCheckerBoard, squareLabel, type Square } from "./dames.js";

function chunkRows(buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  }
  return rows.slice(0, 5);
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
    .setFooter({ text: "Clique sur un pion, puis sur sa destination." });
}

export function turnStatusLine(game: DamesGame): string {
  return `Au tour de <@${game.players[game.turn]}> (${game.turn === "w" ? "blancs" : "noirs"}).`;
}

export function buildFromButtonRows(game: DamesGame): ActionRowBuilder<ButtonBuilder>[] {
  const buttons: ButtonBuilder[] = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = game.board[rank][file];
      if (!piece || piece.color !== game.turn) continue;
      const from: Square = { file, rank };
      if (legalMovesForSquare(game.board, from).length === 0) continue;
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`dames:${game.channelId}:from:${squareLabel(from)}`)
          .setLabel(`${piece.king ? (piece.color === "w" ? "🟠" : "🟣") : piece.color === "w" ? "⚪" : "⚫"} ${squareLabel(from)}`)
          .setStyle(ButtonStyle.Secondary),
      );
    }
  }
  return chunkRows(buttons.slice(0, 25));
}

export function buildToButtonRows(game: DamesGame, from: Square): ActionRowBuilder<ButtonBuilder>[] {
  const moves = legalMovesForSquare(game.board, from);
  if (moves.length === 0) return [];

  const buttons = moves.slice(0, 24).map((move) => {
    return new ButtonBuilder()
      .setCustomId(`dames:${game.channelId}:to:${squareLabel(from)}:${squareLabel(move.to)}`)
      .setLabel(move.captured ? `${squareLabel(move.to)} ⚔️` : squareLabel(move.to))
      .setStyle(move.captured ? ButtonStyle.Danger : ButtonStyle.Primary);
  });
  buttons.push(
    new ButtonBuilder()
      .setCustomId(`dames:${game.channelId}:back`)
      .setLabel("↩️ Changer de pion")
      .setStyle(ButtonStyle.Secondary),
  );
  return chunkRows(buttons);
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
