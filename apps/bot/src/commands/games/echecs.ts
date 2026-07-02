import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";
import { chessGames, createChessGame, type ChessGame } from "../../lib/chess-store.js";
import { allLegalMoves, applyMove, isInCheck, legalMoves, parseSquare, renderBoard, type PieceColor } from "../../lib/chess.js";

async function bumpStat(guildId: string, userId: string, field: "wins" | "losses" | "draws") {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "ECHECS" } },
    create: { guildId, userId, game: "ECHECS", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
}

function opponentColor(color: PieceColor): PieceColor {
  return color === "w" ? "b" : "w";
}

function buildChessEmbed(game: ChessGame, statusLine: string) {
  return new EmbedBuilder()
    .setColor(0x7f77dd)
    .setTitle("♟️ Echecs")
    .setDescription(`\`\`\`\n${renderBoard(game.board)}\n\`\`\`\n${statusLine}`)
    .addFields(
      { name: "Blancs", value: `<@${game.players.w}>`, inline: true },
      { name: "Noirs", value: `<@${game.players.b}>`, inline: true },
    )
    .setFooter({ text: "Joue avec /echecs jouer coup:e2e4 (case de depart + case d'arrivee)" });
}

async function endGame(game: ChessGame, winnerId: string | null) {
  game.active = false;
  chessGames.delete(game.channelId);
  if (!winnerId) return;

  const loserId = winnerId === game.players.w ? game.players.b : game.players.w;
  await bumpStat(game.guildId, winnerId, "wins");
  await bumpStat(game.guildId, loserId, "losses");
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("echecs")
    .setDescription("Joue aux echecs contre un membre")
    .addSubcommand((sub) =>
      sub.setName("defier").setDescription("Defie un membre aux echecs").addUserOption((opt) => opt.setName("adversaire").setDescription("Ton adversaire").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub.setName("jouer").setDescription("Joue un coup").addStringOption((opt) => opt.setName("coup").setDescription("Ex: e2e4").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("voir").setDescription("Affiche l'echiquier actuel"))
    .addSubcommand((sub) => sub.setName("abandonner").setDescription("Abandonne la partie en cours")),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.channelId) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "defier") {
      if (chessGames.get(interaction.channelId)?.active) {
        await interaction.reply({ content: "Une partie d'echecs est deja en cours dans ce salon !", ephemeral: true });
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

      const game = createChessGame(interaction.channelId, interaction.guildId, interaction.user.id, opponent.id);
      await interaction.reply({
        embeds: [buildChessEmbed(game, `${interaction.user} (blancs) contre ${opponent} (noirs). Aux blancs de jouer !`)],
      });
      return;
    }

    const game = chessGames.get(interaction.channelId);
    if (!game?.active) {
      await interaction.reply({ content: "Aucune partie d'echecs active dans ce salon. Utilise `/echecs defier`.", ephemeral: true });
      return;
    }

    if (sub === "voir") {
      const check = isInCheck(game.board, game.turn) ? " Echec !" : "";
      await interaction.reply({ embeds: [buildChessEmbed(game, `Au tour de <@${game.players[game.turn]}> (${game.turn === "w" ? "blancs" : "noirs"}).${check}`)] });
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
      await interaction.reply({ content: "Format invalide. Exemple : `e2e4` (case de depart + case d'arrivee).", ephemeral: true });
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

    const possible = legalMoves(game.board, from);
    if (!possible.some((m) => m.file === to.file && m.rank === to.rank)) {
      await interaction.reply({ content: "Coup illegal.", ephemeral: true });
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
        await interaction.reply({
          embeds: [buildChessEmbed(game, `Echec et mat ! <@${winnerId}> remporte la partie !`)],
        });
        await endGame(game, winnerId);
        return;
      }

      await interaction.reply({ embeds: [buildChessEmbed(game, "Pat ! Partie nulle.")] });
      await bumpStat(game.guildId, game.players.w, "draws");
      await bumpStat(game.guildId, game.players.b, "draws");
      game.active = false;
      chessGames.delete(game.channelId);
      return;
    }

    const checkLine = inCheck ? " Echec !" : "";
    await interaction.reply({
      embeds: [buildChessEmbed(game, `Au tour de <@${game.players[nextTurn]}> (${nextTurn === "w" ? "blancs" : "noirs"}).${checkLine}`)],
    });
  },
};

export default command;
