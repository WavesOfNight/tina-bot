import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { games, createGame, createFakePlayerIds } from "../../lib/loupgarou-store.js";
import { closeLobby, forceStopGame, startGame } from "../../lib/loupgarou-engine.js";

const DEFAULT_MIN_PLAYERS = 5;
const DEFAULT_LOBBY_SECONDS = 90;

export function buildLobbyEmbed(hostId: string, playerCount: number, minPlayers: number) {
  return new EmbedBuilder()
    .setColor(0x8b0000)
    .setTitle("🐺 Loup-Garou")
    .setDescription(
      `Une partie est organisée par <@${hostId}> !\n\nJoueurs inscrits : **${playerCount}** (minimum ${minPlayers})\n\nClique sur "Rejoindre" pour participer.`,
    );
}

export function buildLobbyButtons(guildId: string) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`loupgarou:join:${guildId}`).setLabel("Rejoindre").setEmoji("🐺").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`loupgarou:startnow:${guildId}`).setLabel("Démarrer maintenant").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`loupgarou:cancel:${guildId}`).setLabel("Annuler").setStyle(ButtonStyle.Danger),
    ),
  ];
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("loupgarou")
    .setDescription("Lance une partie de Loup-Garou en vocal")
    .addSubcommand((sub) =>
      sub
        .setName("lancer")
        .setDescription("Ouvre un lobby pour une nouvelle partie")
        .addBooleanOption((opt) => opt.setName("voyante").setDescription("Inclure la Voyante (défaut: oui)"))
        .addBooleanOption((opt) => opt.setName("sorciere").setDescription("Inclure la Sorcière (défaut: oui)"))
        .addBooleanOption((opt) => opt.setName("chasseur").setDescription("Inclure le Chasseur (défaut: oui)"))
        .addBooleanOption((opt) => opt.setName("cupidon").setDescription("Inclure Cupidon (défaut: oui)"))
        .addIntegerOption((opt) => opt.setName("min_joueurs").setDescription("Minimum de joueurs (défaut: 5)").setMinValue(3).setMaxValue(30))
        .addIntegerOption((opt) =>
          opt.setName("duree_lobby").setDescription("Durée du lobby en secondes (défaut: 90)").setMinValue(20).setMaxValue(300),
        ),
    )
    .addSubcommand((sub) => sub.setName("stop").setDescription("Arrête de force la partie en cours sur ce serveur"))
    .addSubcommand((sub) =>
      sub
        .setName("admintest")
        .setDescription("[Admin] Lance une partie de test avec de faux joueurs qui agissent tout seuls")
        .addIntegerOption((opt) =>
          opt.setName("joueurs").setDescription("Nombre total de joueurs simulés, toi inclus (défaut: 6)").setMinValue(3).setMaxValue(20),
        )
        .addBooleanOption((opt) => opt.setName("voyante").setDescription("Inclure la Voyante (défaut: oui)"))
        .addBooleanOption((opt) => opt.setName("sorciere").setDescription("Inclure la Sorcière (défaut: oui)"))
        .addBooleanOption((opt) => opt.setName("chasseur").setDescription("Inclure le Chasseur (défaut: oui)"))
        .addBooleanOption((opt) => opt.setName("cupidon").setDescription("Inclure Cupidon (défaut: oui)")),
    ),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.guild || !interaction.channelId) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "stop") {
      const game = games.get(interaction.guildId);
      if (!game) {
        await interaction.reply({ content: "Aucune partie de loup-garou en cours sur ce serveur.", ephemeral: true });
        return;
      }
      const isHost = game.hostId === interaction.user.id;
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
      if (!isHost && !isAdmin) {
        await interaction.reply({ content: "Seul l'organisateur ou un administrateur peut arrêter la partie.", ephemeral: true });
        return;
      }
      await interaction.reply("🛑 Partie de loup-garou arrêtée, tout le monde est ramené au salon habituel.");
      await forceStopGame(interaction.client, interaction.guild, game);
      return;
    }

    if (sub === "admintest") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "Réservé aux administrateurs (permission Gérer le serveur).", ephemeral: true });
        return;
      }
      if (games.has(interaction.guildId)) {
        await interaction.reply({ content: "Une partie de loup-garou est déjà en cours ou en lobby sur ce serveur.", ephemeral: true });
        return;
      }

      const roleOptions = {
        voyante: interaction.options.getBoolean("voyante") ?? true,
        sorciere: interaction.options.getBoolean("sorciere") ?? true,
        chasseur: interaction.options.getBoolean("chasseur") ?? true,
        cupidon: interaction.options.getBoolean("cupidon") ?? true,
      };
      const totalPlayers = interaction.options.getInteger("joueurs") ?? 6;
      const fakeCount = totalPlayers - 1;

      const game = createGame(interaction.guildId, interaction.user.id, interaction.channelId, roleOptions, 1);
      game.lobbyPlayerIds.add(interaction.user.id);
      for (const fakeId of createFakePlayerIds(fakeCount)) game.lobbyPlayerIds.add(fakeId);

      await interaction.reply(
        `🧪 **Mode test admin** lancé avec toi + ${fakeCount} joueur(s) fictif(s). Vérifie tes messages privés pour ton rôle - les faux joueurs votent et agissent tout seuls, seules tes propres actions demandent un clic.`,
      );
      await startGame(interaction.client, interaction.guild, game);
      return;
    }

    // sub === "lancer"
    if (games.has(interaction.guildId)) {
      await interaction.reply({ content: "Une partie de loup-garou est déjà en cours ou en lobby sur ce serveur.", ephemeral: true });
      return;
    }

    const roleOptions = {
      voyante: interaction.options.getBoolean("voyante") ?? true,
      sorciere: interaction.options.getBoolean("sorciere") ?? true,
      chasseur: interaction.options.getBoolean("chasseur") ?? true,
      cupidon: interaction.options.getBoolean("cupidon") ?? true,
    };
    const minPlayers = interaction.options.getInteger("min_joueurs") ?? DEFAULT_MIN_PLAYERS;
    const lobbySeconds = interaction.options.getInteger("duree_lobby") ?? DEFAULT_LOBBY_SECONDS;

    const game = createGame(interaction.guildId, interaction.user.id, interaction.channelId, roleOptions, minPlayers);
    game.lobbyPlayerIds.add(interaction.user.id);

    await interaction.reply({
      embeds: [buildLobbyEmbed(interaction.user.id, game.lobbyPlayerIds.size, minPlayers)],
      components: buildLobbyButtons(interaction.guildId),
    });
    const reply = await interaction.fetchReply().catch(() => null);
    game.lobbyMessageId = reply?.id ?? null;

    const guild = interaction.guild;
    const client = interaction.client;
    const timeout = setTimeout(() => {
      void closeLobby(client, guild, game);
    }, lobbySeconds * 1000);
    game.activeTimeouts.push(timeout);
  },
};

export default command;
