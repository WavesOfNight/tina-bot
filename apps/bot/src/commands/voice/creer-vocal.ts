import { ActionRowBuilder, ChannelType, EmbedBuilder, PermissionFlagsBits, Routes, SlashCommandBuilder, UserSelectMenuBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";
import { findChannelNameViolation } from "../../lib/hub-voice.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("creer-vocal")
    .setDescription("Crée ton propre salon vocal personnalisé et t'y déplace")
    .addStringOption((opt) => opt.setName("nom").setDescription("Nom du salon (par défaut : ton pseudo)").setMaxLength(100))
    .addIntegerOption((opt) =>
      opt.setName("limite").setDescription("Nombre maximum de personnes (0 ou vide = illimité)").setMinValue(0).setMaxValue(99),
    )
    .addStringOption((opt) => opt.setName("description").setDescription("Description affichée sous le salon").setMaxLength(500)),
  async execute(interaction) {
    if (!interaction.guild) return;

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const currentChannel = member?.voice.channel;
    if (!member || !currentChannel) {
      await interaction.reply({ content: "Tu dois être connecté à un salon vocal pour utiliser cette commande.", ephemeral: true });
      return;
    }

    const alreadyOwned = await prisma.tempVoiceChannel.findFirst({
      where: { guildId: interaction.guild.id, ownerId: interaction.user.id },
    });
    if (alreadyOwned) {
      await interaction.reply({
        content:
          "Tu as déjà un salon vocal personnalisé actif - utilise-le, ou attends qu'il soit supprimé (dès qu'il se vide) avant d'en recréer un.",
        ephemeral: true,
      });
      return;
    }

    const name = (interaction.options.getString("nom") ?? `🔊 Salon de ${member.displayName}`).trim().slice(0, 100);
    const limit = interaction.options.getInteger("limite");
    const description = interaction.options.getString("description");

    const nameViolation = await findChannelNameViolation(interaction.guild.id, name);
    if (nameViolation) {
      await interaction.reply({
        content: `Ce nom de salon n'est pas autorisé (terme filtré : "${nameViolation}"). Choisis-en un autre.`,
        ephemeral: true,
      });
      return;
    }
    if (description) {
      const descriptionViolation = await findChannelNameViolation(interaction.guild.id, description);
      if (descriptionViolation) {
        await interaction.reply({
          content: `Cette description n'est pas autorisée (terme filtré : "${descriptionViolation}"). Choisis-en une autre.`,
          ephemeral: true,
        });
        return;
      }
    }

    await interaction.deferReply({ ephemeral: true });

    // Public par defaut, comme les autres salons personnalises - l'acces peut ensuite
    // etre restreint a des membres precis via le menu ci-dessous (voir creervocal.ts,
    // gestionnaire de UserSelectMenu).
    const channel = await interaction.guild.channels
      .create({
        name,
        type: ChannelType.GuildVoice,
        parent: currentChannel.parentId,
        userLimit: limit ?? undefined,
        permissionOverwrites: [
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers],
          },
        ],
      })
      .catch(() => null);

    if (!channel) {
      await interaction.editReply("Impossible de créer le salon (vérifie que j'ai la permission Gérer les salons).");
      return;
    }

    await prisma.tempVoiceChannel.create({ data: { guildId: interaction.guild.id, channelId: channel.id, ownerId: interaction.user.id } });
    await member.voice.setChannel(channel.id).catch(() => null);

    if (description) {
      // "Statut" du salon vocal (fonctionnalité Discord récente) - pas encore wrappée par
      // discord.js, d'où l'appel REST direct. Best-effort : ne bloque jamais la commande.
      await interaction.client.rest.put(Routes.channelVoiceStatus(channel.id), { body: { status: description } }).catch(() => null);
    }

    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle("🔊 Salon vocal créé !")
      .addFields(
        { name: "Nom", value: name, inline: true },
        { name: "Limite", value: limit ? `${limit} membre(s)` : "Illimitée", inline: true },
        { name: "Accès", value: "Tout le monde", inline: true },
      );
    if (description) embed.addFields({ name: "Description", value: description });
    embed.setFooter({ text: "Renommage/paramètres gérés directement depuis Discord - le salon est supprimé dès qu'il se vide." });

    const restrictMenu = new UserSelectMenuBuilder()
      .setCustomId(`creervocal:restrict:${channel.id}`)
      .setPlaceholder("Optionnel : restreindre l'accès à des membres précis")
      .setMinValues(0)
      .setMaxValues(25);
    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(restrictMenu);

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};

export default command;
