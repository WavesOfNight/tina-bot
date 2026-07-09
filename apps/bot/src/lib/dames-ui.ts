import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { DamesGame } from "./dames-store.js";
import { damesGames } from "./dames-store.js";
import { legalMovesForSquare, renderCheckerBoard, squareLabel, type Square } from "./dames.js";

export function buildDamesEmbed(game: DamesGame, statusLine: string) {
  return new EmbedBuilder()
    .setColor(0x9fe1cb)
    .setTitle("⛃ Dames")
    .setDescription(`${renderCheckerBoard(game.board)}\n\n${statusLine}`)
    .addFields(
      { name: "Blancs (w)", value: `<@${game.players.w}>`, inline: true },
      { name: "Noirs (b)", value: `<@${game.players.b}>`, inline: true },
    )
    .setFooter({ text: "Choisis un pion, puis sa destination dans les menus ci-dessous." });
}

export function turnStatusLine(game: DamesGame): string {
  return `Au tour de <@${game.players[game.turn]}> (${game.turn === "w" ? "blancs" : "noirs"}).`;
}

export function buildFromSelectRow(game: DamesGame): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const options: { label: string; value: string }[] = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = game.board[rank][file];
      if (!piece || piece.color !== game.turn) continue;
      const from: Square = { file, rank };
      if (legalMovesForSquare(game.board, from).length === 0) continue;
      options.push({ label: `${piece.king ? "Dame" : "Pion"} en ${squareLabel(from)}`, value: squareLabel(from) });
    }
  }
  if (options.length === 0) return null;

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`dames:${game.channelId}:from`)
    .setPlaceholder("Choisis un pion a deplacer")
    .addOptions(options.slice(0, 25));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export function buildToSelectRow(game: DamesGame, from: Square): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const moves = legalMovesForSquare(game.board, from);
  if (moves.length === 0) return null;

  const options = moves.slice(0, 24).map((move) => ({
    label: move.captured ? `${squareLabel(move.to)} (prise !)` : squareLabel(move.to),
    value: squareLabel(move.to),
  }));
  options.push({ label: "Changer de pion", value: "__back__" });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`dames:${game.channelId}:to:${squareLabel(from)}`)
    .setPlaceholder(`Destination pour ton pion en ${squareLabel(from)}`)
    .addOptions(options);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
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
