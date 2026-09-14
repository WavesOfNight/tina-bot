import type { ButtonHandler } from "../types.js";
import { games, getPlayer } from "../lib/loupgarou-store.js";
import { ROLES } from "../lib/loupgarou-roles.js";
import { buildLobbyEmbed, buildLobbyButtons } from "../commands/games/loupgarou.js";
import {
  closeLobby,
  forceStopGame,
  handleCupidPick1,
  handleCupidPick2,
  handleWolfVote,
  handleVoyantePick,
  advanceFromVoyante,
  handleWitchAction,
  handleChasseurShot,
  handleVillageVote,
} from "../lib/loupgarou-engine.js";

const handler: ButtonHandler = {
  prefix: "loupgarou",
  async execute(interaction, parts) {
    const [action, guildId, arg] = parts;
    if (!guildId) return;

    const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      await interaction.reply({ content: "Ce serveur n'est plus accessible.", ephemeral: true });
      return;
    }
    const game = games.get(guildId);

    if (action === "join") {
      if (!game || game.phase !== "LOBBY") {
        await interaction.reply({ content: "Cette partie n'est plus ouverte aux inscriptions.", ephemeral: true });
        return;
      }
      if (game.lobbyPlayerIds.has(interaction.user.id)) {
        await interaction.reply({ content: "Tu es déjà inscrit !", ephemeral: true });
        return;
      }
      game.lobbyPlayerIds.add(interaction.user.id);
      await interaction.update({
        embeds: [buildLobbyEmbed(game.hostId, game.lobbyPlayerIds.size, game.minPlayers)],
        components: buildLobbyButtons(guildId),
      });
      return;
    }

    if (action === "startnow") {
      if (!game || game.phase !== "LOBBY") {
        await interaction.reply({ content: "Cette partie n'est plus en lobby.", ephemeral: true });
        return;
      }
      if (interaction.user.id !== game.hostId) {
        await interaction.reply({ content: "Seul l'organisateur peut démarrer la partie maintenant.", ephemeral: true });
        return;
      }
      await interaction.reply({ content: "Démarrage en cours...", ephemeral: true });
      await closeLobby(interaction.client, guild, game);
      return;
    }

    if (action === "cancel") {
      if (!game || game.phase !== "LOBBY") {
        await interaction.reply({ content: "Cette partie n'est plus en lobby.", ephemeral: true });
        return;
      }
      if (interaction.user.id !== game.hostId) {
        await interaction.reply({ content: "Seul l'organisateur peut annuler la partie.", ephemeral: true });
        return;
      }
      await interaction.update({ content: "❌ Partie annulée par l'organisateur.", embeds: [], components: [] });
      await forceStopGame(interaction.client, guild, game);
      return;
    }

    if (!game) {
      await interaction.reply({ content: "Cette partie n'existe plus.", ephemeral: true });
      return;
    }

    if (action === "wolfvote") {
      const ok = await handleWolfVote(interaction.client, guild, game, interaction.user.id, arg);
      await interaction.reply({ content: ok ? "🐺 Vote enregistré." : "Tu ne peux pas voter ici.", ephemeral: true });
      return;
    }

    if (action === "villagevote") {
      const ok = await handleVillageVote(interaction.client, guild, game, interaction.user.id, arg);
      await interaction.reply({ content: ok ? "🗳️ Vote enregistré." : "Tu ne peux pas voter (tu es peut-être éliminé).", ephemeral: true });
      return;
    }

    if (action === "cupid1" || action === "cupid2") {
      if (getPlayer(game, interaction.user.id)?.role !== "CUPIDON") {
        await interaction.reply({ content: "Ce n'est pas ton action.", ephemeral: true });
        return;
      }
      await interaction.reply({ content: "💘 Choix enregistré.", ephemeral: true });
      if (action === "cupid1") await handleCupidPick1(interaction.client, guild, game, arg);
      else await handleCupidPick2(interaction.client, guild, game, arg);
      return;
    }

    if (action === "voyante") {
      if (getPlayer(game, interaction.user.id)?.role !== "VOYANTE") {
        await interaction.reply({ content: "Ce n'est pas ton action.", ephemeral: true });
        return;
      }
      const role = await handleVoyantePick(guild, game, interaction.user.id, arg);
      if (!role) {
        await interaction.reply({ content: "Action impossible (le tour est peut-être déjà passé).", ephemeral: true });
        return;
      }
      await interaction.reply({ content: `🔮 Ce joueur est **${ROLES[role].name}** !`, ephemeral: true });
      await advanceFromVoyante(interaction.client, guild, game);
      return;
    }

    if (action === "witchsave" || action === "witchpoison" || action === "witchskip") {
      if (getPlayer(game, interaction.user.id)?.role !== "SORCIERE") {
        await interaction.reply({ content: "Ce n'est pas ton action.", ephemeral: true });
        return;
      }
      await interaction.reply({ content: "🧪 Choix enregistré.", ephemeral: true });
      const witchAction = action === "witchsave" ? "save" : action === "witchpoison" ? "poison" : "skip";
      await handleWitchAction(interaction.client, guild, game, witchAction, action === "witchskip" ? null : arg);
      return;
    }

    if (action === "chasseur") {
      const shooter = getPlayer(game, interaction.user.id);
      if (!shooter || shooter.role !== "CHASSEUR" || shooter.alive) {
        await interaction.reply({ content: "Ce n'est pas ton action.", ephemeral: true });
        return;
      }
      await interaction.reply({ content: "🏹 Tir enregistré.", ephemeral: true });
      await handleChasseurShot(interaction.client, guild, game, arg);
      return;
    }
  },
};

export default handler;
