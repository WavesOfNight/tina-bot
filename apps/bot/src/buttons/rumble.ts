import type { TextChannel } from "discord.js";
import type { ButtonHandler } from "../types.js";
import { MAX_RUMBLE_PLAYERS, rumbleGames } from "../lib/rumble-store.js";
import { runRumble } from "../lib/rumble-runner.js";
import { buildRumbleComponents, buildRumbleEmbed } from "../commands/games/rumble.js";

const handler: ButtonHandler = {
  prefix: "rumble",
  async execute(interaction, parts) {
    const [action, gameId] = parts;
    const game = rumbleGames.get(gameId);

    if (!game || game.phase !== "registration") {
      await interaction.reply({ content: "Les inscriptions sont fermees pour ce combat.", ephemeral: true });
      return;
    }

    if (action === "join") {
      if (game.players.includes(interaction.user.id)) {
        await interaction.reply({ content: "Tu es deja inscrit(e) !", ephemeral: true });
        return;
      }
      if (game.players.length >= MAX_RUMBLE_PLAYERS) {
        await interaction.reply({ content: "Le combat est complet !", ephemeral: true });
        return;
      }
      game.players.push(interaction.user.id);
      await interaction.update({ embeds: [buildRumbleEmbed(game)], components: buildRumbleComponents(gameId, "registration") });
      return;
    }

    if (action === "start") {
      if (interaction.user.id !== game.hostId) {
        await interaction.reply({ content: "Seul l'organisateur peut lancer le combat plus tot.", ephemeral: true });
        return;
      }
      if (game.players.length < 2) {
        await interaction.reply({ content: "Il faut au moins 2 participants pour lancer le combat.", ephemeral: true });
        return;
      }

      game.phase = "running";
      await interaction.update({ embeds: [buildRumbleEmbed(game)], components: buildRumbleComponents(gameId, "running") });
      await runRumble(interaction.channel as TextChannel, gameId);
    }
  },
};

export default handler;
