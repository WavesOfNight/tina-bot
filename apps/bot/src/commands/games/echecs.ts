import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { chessGames, createChessGame } from "../../lib/chess-store.js";
import { bumpChessStat, buildChessEmbed, buildFromButtonRows, turnStatusLine } from "../../lib/chess-ui.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("echecs")
    .setDescription("Joue aux echecs contre un membre")
    .addSubcommand((sub) =>
      sub.setName("defier").setDescription("Defie un membre aux echecs").addUserOption((opt) => opt.setName("adversaire").setDescription("Ton adversaire").setRequired(true)),
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
        components: buildFromButtonRows(game),
      });
      return;
    }

    const game = chessGames.get(interaction.channelId);
    if (!game?.active) {
      await interaction.reply({ content: "Aucune partie d'echecs active dans ce salon. Utilise `/echecs defier`.", ephemeral: true });
      return;
    }

    if (sub === "voir") {
      await interaction.reply({
        embeds: [buildChessEmbed(game, turnStatusLine(game))],
        components: buildFromButtonRows(game),
      });
      return;
    }

    // sub === "abandonner"
    if (interaction.user.id !== game.players.w && interaction.user.id !== game.players.b) {
      await interaction.reply({ content: "Tu ne participes pas a cette partie.", ephemeral: true });
      return;
    }
    const winnerId = interaction.user.id === game.players.w ? game.players.b : game.players.w;
    await interaction.reply(`${interaction.user} abandonne la partie. <@${winnerId}> gagne !`);
    game.active = false;
    chessGames.delete(game.channelId);
    const loserId = interaction.user.id;
    await bumpChessStat(game.guildId, winnerId, "wins");
    await bumpChessStat(game.guildId, loserId, "losses");
  },
};

export default command;
