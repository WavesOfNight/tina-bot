import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";
import { damesGames, createDamesGame, type DamesGame } from "../../lib/dames-store.js";
import { applyCheckerMove, countPieces, hasAnyLegalMove, legalMovesForSquare, parseSquare, renderCheckerBoard, type CheckerColor } from "../../lib/dames.js";

async function bumpStat(guildId: string, userId: string, field: "wins" | "losses" | "draws") {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "DAMES" } },
    create: { guildId, userId, game: "DAMES", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
}

function opponentColor(color: CheckerColor): CheckerColor {
  return color === "w" ? "b" : "w";
}

function buildDamesEmbed(game: DamesGame, statusLine: string) {
  return new EmbedBuilder()
    .setColor(0x9fe1cb)
    .setTitle("⛃ Dames")
    .setDescription(`\`\`\`\n${renderCheckerBoard(game.board)}\n\`\`\`\n${statusLine}`)
    .addFields(
      { name: "Blancs (w)", value: `<@${game.players.w}>`, inline: true },
      { name: "Noirs (b)", value: `<@${game.players.b}>`, inline: true },
    )
    .setFooter({ text: "Joue avec /dames jouer coup:b1a2 (case de depart + case d'arrivee)" });
}

async function endGame(game: DamesGame, winnerId: string | null) {
  game.active = false;
  damesGames.delete(game.channelId);
  if (!winnerId) return;

  const loserId = winnerId === game.players.w ? game.players.b : game.players.w;
  await bumpStat(game.guildId, winnerId, "wins");
  await bumpStat(game.guildId, loserId, "losses");
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dames")
    .setDescription("Joue aux dames contre un membre")
    .addSubcommand((sub) =>
      sub.setName("defier").setDescription("Defie un membre aux dames").addUserOption((opt) => opt.setName("adversaire").setDescription("Ton adversaire").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub.setName("jouer").setDescription("Joue un coup").addStringOption((opt) => opt.setName("coup").setDescription("Ex: b1a2").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("voir").setDescription("Affiche le plateau actuel"))
    .addSubcommand((sub) => sub.setName("abandonner").setDescription("Abandonne la partie en cours")),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.channelId) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "defier") {
      if (damesGames.get(interaction.channelId)?.active) {
        await interaction.reply({ content: "Une partie de dames est deja en cours dans ce salon !", ephemeral: true });
        return;
      }

      const opponent = interaction.options.getUser("adversaire", true);
      if (opponent.bot) {
        await interaction.reply({ content: "Tu ne peux pas defier un bot.", ephemeral: true });
        return;
      }
      if (opponent.id === interaction.user.id) {
        await interaction.reply({ content: "Il te faut un adversaire different de toi-meme.", ephemeral: true });
        return;
      }

      const game = createDamesGame(interaction.channelId, interaction.guildId, interaction.user.id, opponent.id);
      await interaction.reply({
        embeds: [buildDamesEmbed(game, `${interaction.user} (blancs) contre ${opponent} (noirs). Aux blancs de jouer !`)],
      });
      return;
    }

    const game = damesGames.get(interaction.channelId);
    if (!game?.active) {
      await interaction.reply({ content: "Aucune partie de dames active dans ce salon. Utilise `/dames defier`.", ephemeral: true });
      return;
    }

    if (sub === "voir") {
      await interaction.reply({ embeds: [buildDamesEmbed(game, `Au tour de <@${game.players[game.turn]}> (${game.turn === "w" ? "blancs" : "noirs"}).`)] });
      return;
    }

    if (sub === "abandonner") {
      if (interaction.user.id !== game.players.w && interaction.user.id !== game.players.b) {
        await interaction.reply({ content: "Tu ne participes pas a cette partie.", ephemeral: true });
        return;
      }
      const winnerId = interaction.user.id === game.players.w ? game.players.b : game.players.w;
      await interaction.reply(`${interaction.user} abandonne la partie. <@${winnerId}> gagne !`);
      await endGame(game, winnerId);
      return;
    }

    // sub === "jouer"
    if (interaction.user.id !== game.players[game.turn]) {
      await interaction.reply({ content: "Ce n'est pas ton tour.", ephemeral: true });
      return;
    }

    const rawMove = interaction.options.getString("coup", true).trim().toLowerCase().replace(/[\s-]/g, "");
    if (rawMove.length !== 4) {
      await interaction.reply({ content: "Format invalide. Exemple : `b1a2` (case de depart + case d'arrivee).", ephemeral: true });
      return;
    }

    const from = parseSquare(rawMove.slice(0, 2));
    const to = parseSquare(rawMove.slice(2, 4));
    if (!from || !to) {
      await interaction.reply({ content: "Case invalide. Utilise la notation `a1` a `h8`.", ephemeral: true });
      return;
    }

    const piece = game.board[from.rank][from.file];
    if (!piece || piece.color !== game.turn) {
      await interaction.reply({ content: "Il n'y a pas une de tes pieces sur cette case.", ephemeral: true });
      return;
    }

    const possible = legalMovesForSquare(game.board, from);
    const chosen = possible.find((m) => m.to.file === to.file && m.to.rank === to.rank);
    if (!chosen) {
      await interaction.reply({ content: "Coup illegal.", ephemeral: true });
      return;
    }

    game.board = applyCheckerMove(game.board, from, chosen);
    const nextTurn = opponentColor(game.turn);
    game.turn = nextTurn;

    const opponentPieces = countPieces(game.board, nextTurn);
    if (opponentPieces === 0 || !hasAnyLegalMove(game.board, nextTurn)) {
      const winnerId = game.players[opponentColor(nextTurn)];
      await interaction.reply({
        embeds: [buildDamesEmbed(game, `<@${winnerId}> remporte la partie !`)],
      });
      await endGame(game, winnerId);
      return;
    }

    await interaction.reply({
      embeds: [buildDamesEmbed(game, `Au tour de <@${game.players[nextTurn]}> (${nextTurn === "w" ? "blancs" : "noirs"}).`)],
    });
  },
};

export default command;
