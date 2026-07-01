import { prisma } from "@tina/database";
import type { ButtonHandler } from "../types.js";
import { morpionGames, checkWinner } from "../lib/morpion-store.js";
import { buildBoardRows } from "../commands/games/morpion.js";

async function bumpStat(guildId: string, userId: string, field: "wins" | "losses" | "draws") {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "MORPION" } },
    create: { guildId, userId, game: "MORPION", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
}

const handler: ButtonHandler = {
  prefix: "morpion",
  async execute(interaction, parts) {
    const [gameId, indexStr] = parts;
    const game = morpionGames.get(gameId);

    if (!game) {
      await interaction.reply({ content: "Cette partie n'existe plus.", ephemeral: true });
      return;
    }

    const playerIndex = game.players.indexOf(interaction.user.id);
    if (playerIndex === -1) {
      await interaction.reply({ content: "Cette partie ne t'appartient pas.", ephemeral: true });
      return;
    }
    if (playerIndex !== game.turn) {
      await interaction.reply({ content: "Ce n'est pas ton tour.", ephemeral: true });
      return;
    }

    const index = Number(indexStr);
    if (game.board[index] !== null) {
      await interaction.reply({ content: "Cette case est deja prise.", ephemeral: true });
      return;
    }

    game.board[index] = playerIndex === 0 ? "X" : "O";
    const result = checkWinner(game.board);

    if (result) {
      morpionGames.delete(gameId);
      const [p1, p2] = game.players;

      if (result === "draw") {
        await bumpStat(game.guildId, p1, "draws");
        await bumpStat(game.guildId, p2, "draws");
        await interaction.update({
          content: `Match nul entre <@${p1}> et <@${p2}> !`,
          components: buildBoardRows(gameId, game.board, true),
        });
        return;
      }

      const winnerId = result === "X" ? p1 : p2;
      const loserId = result === "X" ? p2 : p1;
      await bumpStat(game.guildId, winnerId, "wins");
      await bumpStat(game.guildId, loserId, "losses");

      await interaction.update({
        content: `Victoire de <@${winnerId}> !`,
        components: buildBoardRows(gameId, game.board, true),
      });
      return;
    }

    game.turn = game.turn === 0 ? 1 : 0;
    const nextPlayerId = game.players[game.turn];

    await interaction.update({
      content: `Morpion : <@${game.players[0]}> (X) contre <@${game.players[1]}> (O). A <@${nextPlayerId}> de jouer !`,
      components: buildBoardRows(gameId, game.board),
    });
  },
};

export default handler;
