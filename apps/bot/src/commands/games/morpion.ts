import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { morpionGames } from "../../lib/morpion-store.js";
import { createMatch } from "../../lib/match-store.js";

function buildBoardRows(gameId: string, board: (null | "X" | "O")[], disabled = false) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let row = 0; row < 3; row++) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    for (let col = 0; col < 3; col++) {
      const index = row * 3 + col;
      const cell = board[index];
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`morpion:${gameId}:${index}`)
          .setLabel(cell ?? "​")
          .setStyle(cell === "X" ? ButtonStyle.Primary : cell === "O" ? ButtonStyle.Danger : ButtonStyle.Secondary)
          .setDisabled(disabled || cell !== null),
      );
    }
    rows.push(actionRow);
  }
  return rows;
}

export function startMorpionRound(players: [string, string], guildId: string, matchId?: string) {
  return { board: Array(9).fill(null) as (null | "X" | "O")[], players, turn: 0 as const, guildId, matchId };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("morpion")
    .setDescription("Defie quelqu'un a une partie de morpion")
    .addUserOption((opt) => opt.setName("adversaire").setDescription("Ton adversaire").setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName("manches")
        .setDescription("Nombre de manches (defaut : 1)")
        .addChoices({ name: "1 manche", value: 1 }, { name: "Best of 3", value: 3 }, { name: "Best of 5", value: 5 }),
    ),
  async execute(interaction) {
    const opponent = interaction.options.getUser("adversaire", true);
    const bestOf = interaction.options.getInteger("manches") ?? 1;

    if (opponent.bot) {
      await interaction.reply({ content: "Tu ne peux pas defier un bot.", ephemeral: true });
      return;
    }
    if (opponent.id === interaction.user.id) {
      await interaction.reply({ content: "Il te faut un adversaire different de toi-meme.", ephemeral: true });
      return;
    }

    const players: [string, string] = [interaction.user.id, opponent.id];
    const board: (null | "X" | "O")[] = Array(9).fill(null);

    const matchSuffix = bestOf > 1 ? ` (manche 1/${bestOf})` : "";
    const reply = await interaction.reply({
      content: `Morpion : ${interaction.user} (X) contre ${opponent} (O)${matchSuffix}. A ${interaction.user} de jouer !`,
      components: buildBoardRows("pending", board),
      fetchReply: true,
    });

    const gameId = reply.id;
    const match =
      bestOf > 1
        ? createMatch({ matchId: gameId, game: "MORPION", players, bestOf, guildId: interaction.guildId!, channelId: interaction.channelId })
        : null;

    morpionGames.set(gameId, { board, players, turn: 0, guildId: interaction.guildId!, matchId: match?.matchId });

    await interaction.editReply({
      content: `Morpion : ${interaction.user} (X) contre ${opponent} (O)${matchSuffix}. A ${interaction.user} de jouer !`,
      components: buildBoardRows(gameId, board),
    });
  },
};

export default command;
export { buildBoardRows };
