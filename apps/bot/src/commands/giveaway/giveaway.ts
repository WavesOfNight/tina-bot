import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, type TextChannel } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";
import { parseDuration } from "../../lib/duration.js";
import { buildGiveawayComponents, buildGiveawayEmbed, endGiveaway } from "../../lib/giveaway.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Gere les giveaways du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Demarre un giveaway")
        .addStringOption((opt) => opt.setName("prix").setDescription("Ce qui est a gagner").setRequired(true))
        .addStringOption((opt) =>
          opt.setName("duree").setDescription("Duree (ex: 10m, 2h, 1d)").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt.setName("gagnants").setDescription("Nombre de gagnants").setMinValue(1).setMaxValue(20),
        )
        .addChannelOption((opt) =>
          opt.setName("salon").setDescription("Salon ou publier le giveaway").addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("Termine un giveaway immediatement")
        .addIntegerOption((opt) => opt.setName("id").setDescription("Identifiant du giveaway").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reroll")
        .setDescription("Retire un nouveau gagnant pour un giveaway termine")
        .addIntegerOption((opt) => opt.setName("id").setDescription("Identifiant du giveaway").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("Liste les giveaways actifs")),
  async execute(interaction) {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });

    if (sub === "start") {
      const prize = interaction.options.getString("prix", true);
      const durationInput = interaction.options.getString("duree", true);
      const winnerCount = interaction.options.getInteger("gagnants") ?? 1;
      const channel =
        (interaction.options.getChannel("salon") as TextChannel | null) ?? (interaction.channel as TextChannel);

      const durationMs = parseDuration(durationInput);
      if (!durationMs) {
        await interaction.reply({ content: "Duree invalide. Exemple : 10m, 2h, 1d.", ephemeral: true });
        return;
      }

      const endsAt = new Date(Date.now() + durationMs);
      const giveaway = await prisma.giveaway.create({
        data: { guildId, channelId: channel.id, prize, winnerCount, hostId: interaction.user.id, endsAt },
      });

      const embed = buildGiveawayEmbed({ prize, winnerCount, hostId: interaction.user.id, endsAt, entryCount: 0 });
      const message = await channel.send({ embeds: [embed], components: buildGiveawayComponents(giveaway.id) });
      await prisma.giveaway.update({ where: { id: giveaway.id }, data: { messageId: message.id } });

      await interaction.reply({ content: `Giveaway #${giveaway.id} lance dans ${channel} !`, ephemeral: true });
      return;
    }

    if (sub === "end") {
      const id = interaction.options.getInteger("id", true);
      const giveaway = await prisma.giveaway.findFirst({ where: { id, guildId } });
      if (!giveaway) {
        await interaction.reply({ content: "Giveaway introuvable.", ephemeral: true });
        return;
      }
      await endGiveaway(interaction.client, id);
      await interaction.reply({ content: `Giveaway #${id} termine.`, ephemeral: true });
      return;
    }

    if (sub === "reroll") {
      const id = interaction.options.getInteger("id", true);
      const giveaway = await prisma.giveaway.findFirst({ where: { id, guildId }, include: { entries: true } });
      if (!giveaway || !giveaway.ended) {
        await interaction.reply({ content: "Ce giveaway n'est pas termine ou n'existe pas.", ephemeral: true });
        return;
      }
      if (giveaway.entries.length === 0) {
        await interaction.reply({ content: "Aucun participant pour ce giveaway.", ephemeral: true });
        return;
      }
      const newWinner = giveaway.entries[Math.floor(Math.random() * giveaway.entries.length)];
      await interaction.reply(`Nouveau gagnant pour **${giveaway.prize}** : <@${newWinner.userId}> !`);
      return;
    }

    const active = await prisma.giveaway.findMany({ where: { guildId, ended: false }, orderBy: { endsAt: "asc" } });
    if (active.length === 0) {
      await interaction.reply({ content: "Aucun giveaway actif.", ephemeral: true });
      return;
    }
    await interaction.reply(
      `Giveaways actifs :\n${active
        .map((g) => `#${g.id} - **${g.prize}** - fin <t:${Math.floor(g.endsAt.getTime() / 1000)}:R>`)
        .join("\n")}`,
    );
  },
};

export default command;
