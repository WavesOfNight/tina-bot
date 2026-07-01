import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { morpionGames } from "../../lib/morpion-store.js";

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

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("morpion")
    .setDescription("Defie quelqu'un a une partie de morpion")
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

    const board: (null | "X" | "O")[] = Array(9).fill(null);
    const players: [string, string] = [interaction.user.id, opponent.id];

    const reply = await interaction.reply({
      content: `Morpion : ${interaction.user} (X) contre ${opponent} (O). A ${interaction.user} de jouer !`,
      components: buildBoardRows("pending", board),
      fetchReply: true,
    });

    const gameId = reply.id;
    morpionGames.set(gameId, { board, players, turn: 0, guildId: interaction.guildId! });

    await interaction.editReply({
      content: `Morpion : ${interaction.user} (X) contre ${opponent} (O). A ${interaction.user} de jouer !`,
      components: buildBoardRows(gameId, board),
    });
  },
};

export default command;
export { buildBoardRows };
