import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { fetchNowPlaying, formatDuration, progressBar } from "../../lib/azuracast.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("son")
    .setDescription("Infos sur la radio READS (AzuraCast)")
    .addSubcommand((sub) => sub.setName("actuel").setDescription("Le son joue actuellement"))
    .addSubcommand((sub) => sub.setName("historique").setDescription("Les derniers sons joues"))
    .addSubcommand((sub) => sub.setName("auditeurs").setDescription("Nombre d'auditeurs en direct")),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    const data = await fetchNowPlaying();
    if (!data) {
      await interaction.editReply("Impossible de contacter la radio READS pour le moment, retente plus tard.");
      return;
    }

    if (sub === "actuel") {
      const { song, elapsed, duration } = data.now_playing;
      const embed = new EmbedBuilder()
        .setColor(0x7f77dd)
        .setAuthor({ name: `📻 ${data.station.name}` })
        .setTitle(song.title || song.text)
        .setDescription(
          [
            song.artist ? `**Artiste :** ${song.artist}` : null,
            song.album ? `**Album :** ${song.album}` : null,
            "",
            `${formatDuration(elapsed)} ${progressBar(elapsed, duration)} ${formatDuration(duration)}`,
          ]
            .filter((line) => line !== null)
            .join("\n"),
        )
        .setThumbnail(song.art || null)
        .setFooter({
          text: data.live.is_live
            ? `En direct avec ${data.live.streamer_name} - ${data.listeners.current} auditeur(s)`
            : `${data.listeners.current} auditeur(s) en ce moment`,
        });

      if (data.playing_next?.song) {
        const next = data.playing_next.song;
        embed.addFields({ name: "A suivre", value: `${next.artist ? `${next.artist} - ` : ""}${next.title || next.text}` });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === "historique") {
      const items = data.song_history.slice(0, 8);
      if (items.length === 0) {
        await interaction.editReply("Aucun historique disponible pour le moment.");
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x9fe1cb)
        .setAuthor({ name: `📻 ${data.station.name} - Derniers sons joues` })
        .setDescription(
          items
            .map((item) => {
              const label = `${item.song.artist ? `${item.song.artist} - ` : ""}${item.song.title || item.song.text}`;
              return `**${label}** — <t:${item.played_at}:R>`;
            })
            .join("\n"),
        );

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xf0997b)
      .setAuthor({ name: `📻 ${data.station.name}` })
      .addFields(
        { name: "Auditeurs actuels", value: `${data.listeners.current}`, inline: true },
        { name: "Auditeurs uniques", value: `${data.listeners.unique}`, inline: true },
        { name: "Total (cumule)", value: `${data.listeners.total}`, inline: true },
      );

    if (data.live.is_live) {
      embed.addFields({ name: "En direct", value: `🔴 ${data.live.streamer_name}` });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
