import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { damesGames, createDamesGame } from "../../lib/dames-store.js";
import { bumpDamesStat, buildDamesEmbed, buildMoveButtonRows, turnStatusLine } from "../../lib/dames-ui.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dames")
    .setDescription("Joue aux dames contre un membre")
    .addSubcommand((sub) =>
      sub.setName("defier").setDescription("Defie un membre aux dames").addUserOption((opt) => opt.setName("adversaire").setDescription("Ton adversaire").setRequired(true)),
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
        components: buildMoveButtonRows(game),
      });
      return;
    }

    const game = damesGames.get(interaction.channelId);
    if (!game?.active) {
      await interaction.reply({ content: "Aucune partie de dames active dans ce salon. Utilise `/dames defier`.", ephemeral: true });
      return;
    }

    if (sub === "voir") {
      await interaction.reply({
        embeds: [buildDamesEmbed(game, turnStatusLine(game))],
        components: buildMoveButtonRows(game),
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
    damesGames.delete(game.channelId);
    const loserId = interaction.user.id;
    await bumpDamesStat(game.guildId, winnerId, "wins");
    await bumpDamesStat(game.guildId, loserId, "losses");
  },
};

export default command;
