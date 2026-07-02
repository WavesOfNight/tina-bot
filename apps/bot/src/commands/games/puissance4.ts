import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { COLS, connect4Games, createBoard, renderBoard } from "../../lib/connect4-store.js";
import { createMatch } from "../../lib/match-store.js";

export function buildColumnButtons(gameId: string, board: (null | 0 | 1)[][], disabled = false) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder(), new ActionRowBuilder()];
  for (let col = 0; col < COLS; col++) {
    const full = board[0][col] !== null;
    const targetRow = col < 4 ? rows[0] : rows[1];
    targetRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`puissance4:${gameId}:${col}`)
        .setLabel(`${col + 1}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || full),
    );
  }
  return rows;
}

export function startConnect4Round(players: [string, string], guildId: string, matchId?: string) {
  return { board: createBoard(), players, turn: 0 as const, guildId, matchId };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("puissance4")
    .setDescription("Defie quelqu'un a une partie de puissance 4")
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

    const board = createBoard();
    const players: [string, string] = [interaction.user.id, opponent.id];
    const matchSuffix = bestOf > 1 ? ` (manche 1/${bestOf})` : "";

    const reply = await interaction.reply({
      content: `Puissance 4 : ${interaction.user} (🔴) contre ${opponent} (🟡)${matchSuffix}\n\n${renderBoard(board)}\n\nA ${interaction.user} de jouer !`,
      components: buildColumnButtons("pending", board),
      fetchReply: true,
    });

    const gameId = reply.id;
    const match =
      bestOf > 1
        ? createMatch({ matchId: gameId, game: "CONNECT4", players, bestOf, guildId: interaction.guildId!, channelId: interaction.channelId })
        : null;

    connect4Games.set(gameId, { board, players, turn: 0, guildId: interaction.guildId!, matchId: match?.matchId });

    await interaction.editReply({
      content: `Puissance 4 : ${interaction.user} (🔴) contre ${opponent} (🟡)${matchSuffix}\n\n${renderBoard(board)}\n\nA ${interaction.user} de jouer !`,
      components: buildColumnButtons(gameId, board),
    });
  },
};

export default command;
