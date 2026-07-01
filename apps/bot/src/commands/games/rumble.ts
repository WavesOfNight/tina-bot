import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, type TextChannel } from "discord.js";
import type { Command } from "../../types.js";
import { MAX_RUMBLE_PLAYERS, rumbleGames, type RumbleGame } from "../../lib/rumble-store.js";
import { runRumble } from "../../lib/rumble-runner.js";

const REGISTRATION_MS = 30_000;

export function buildRumbleComponents(gameId: string, phase: RumbleGame["phase"]) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`rumble:join:${gameId}`)
        .setLabel("Rejoindre le combat")
        .setEmoji("⚔️")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(phase !== "registration"),
      new ButtonBuilder()
        .setCustomId(`rumble:start:${gameId}`)
        .setLabel("Lancer maintenant")
        .setEmoji("▶️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(phase !== "registration"),
    ),
  ];
}

export function buildRumbleEmbed(game: RumbleGame) {
  return new EmbedBuilder()
    .setColor(0xd85a30)
    .setTitle("⚔️ Battle Royale")
    .setDescription(
      game.phase === "registration"
        ? `Clique sur **Rejoindre le combat** pour t'inscrire ! (max ${MAX_RUMBLE_PLAYERS})\nLe combat commence dans 30 secondes, ou quand l'organisateur clique sur Lancer.`
        : "Le combat a commence, regarde le fil pour suivre l'action !",
    )
    .addFields({ name: "Participants", value: `${game.players.length}` });
}

const command: Command = {
  data: new SlashCommandBuilder().setName("combattre").setDescription("Lance un battle royale textuel pour tout le salon"),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xd85a30)
      .setTitle("⚔️ Battle Royale")
      .setDescription(`Clique sur **Rejoindre le combat** pour t'inscrire ! (max ${MAX_RUMBLE_PLAYERS})\nLe combat commence dans 30 secondes, ou quand l'organisateur clique sur Lancer.`)
      .addFields({ name: "Participants", value: "0" });

    const reply = await interaction.reply({ embeds: [embed], components: buildRumbleComponents("pending", "registration"), fetchReply: true });
    const gameId = reply.id;

    rumbleGames.set(gameId, {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageId: reply.id,
      hostId: interaction.user.id,
      players: [],
      phase: "registration",
    });

    await interaction.editReply({ components: buildRumbleComponents(gameId, "registration") });

    setTimeout(async () => {
      const game = rumbleGames.get(gameId);
      if (game?.phase === "registration") {
        game.phase = game.players.length >= 2 ? "running" : "finished";
        if (game.phase === "finished") {
          rumbleGames.delete(gameId);
          await interaction.followUp("Pas assez de participants pour lancer le combat (2 minimum).").catch(() => null);
          return;
        }
        await interaction.editReply({ embeds: [buildRumbleEmbed(game)], components: buildRumbleComponents(gameId, "running") }).catch(() => null);
        await runRumble(interaction.channel as TextChannel, gameId);
      }
    }, REGISTRATION_MS);
  },
};

export default command;
