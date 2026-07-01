import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { COLS, connect4Games, createBoard, renderBoard } from "../../lib/connect4-store.js";

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

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("puissance4")
    .setDescription("Defie quelqu'un a une partie de puissance 4")
    .addUserOption((opt) => opt.setName("adversaire").setDescription("Ton adversaire").setRequired(true)),
  async execute(interaction) {
    const opponent = interaction.options.getUser("adversaire", true);

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

    const reply = await interaction.reply({
      content: `Puissance 4 : ${interaction.user} (🔴) contre ${opponent} (🟡)\n\n${renderBoard(board)}\n\nA ${interaction.user} de jouer !`,
      components: buildColumnButtons("pending", board),
      fetchReply: true,
    });

    const gameId = reply.id;
    connect4Games.set(gameId, { board, players, turn: 0, guildId: interaction.guildId! });

    await interaction.editReply({
      content: `Puissance 4 : ${interaction.user} (🔴) contre ${opponent} (🟡)\n\n${renderBoard(board)}\n\nA ${interaction.user} de jouer !`,
      components: buildColumnButtons(gameId, board),
    });
  },
};

export default command;
