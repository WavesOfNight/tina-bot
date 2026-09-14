import { ChannelType, EmbedBuilder, PermissionFlagsBits, Routes, SlashCommandBuilder, type User } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";
import { findChannelNameViolation } from "../../lib/hub-voice.js";

const MAX_ALLOWED_MEMBERS = 5;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("creer-vocal")
    .setDescription("Cree ton propre salon vocal personnalise et t'y deplace")
    .addStringOption((opt) => opt.setName("nom").setDescription("Nom du salon (par defaut : ton pseudo)").setMaxLength(100))
    .addIntegerOption((opt) =>
      opt.setName("limite").setDescription("Nombre maximum de personnes (0 ou vide = illimite)").setMinValue(0).setMaxValue(99),
    )
    .addStringOption((opt) => opt.setName("description").setDescription("Description affichee sous le salon").setMaxLength(500))
    .addUserOption((opt) => opt.setName("membre1").setDescription("Salon prive : n'autorise que ce membre (+ les suivants) a le rejoindre"))
    .addUserOption((opt) => opt.setName("membre2").setDescription("Membre autorise supplementaire"))
    .addUserOption((opt) => opt.setName("membre3").setDescription("Membre autorise supplementaire"))
    .addUserOption((opt) => opt.setName("membre4").setDescription("Membre autorise supplementaire"))
    .addUserOption((opt) => opt.setName("membre5").setDescription("Membre autorise supplementaire")),
  async execute(interaction) {
    if (!interaction.guild) return;

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const currentChannel = member?.voice.channel;
    if (!member || !currentChannel) {
      await interaction.reply({ content: "Tu dois etre connecte a un salon vocal pour utiliser cette commande.", ephemeral: true });
      return;
    }

    const alreadyOwned = await prisma.tempVoiceChannel.findFirst({
      where: { guildId: interaction.guild.id, ownerId: interaction.user.id },
    });
    if (alreadyOwned) {
      await interaction.reply({
        content:
          "Tu as deja un salon vocal personnalise actif - utilise-le, ou attends qu'il soit supprime (des qu'il se vide) avant d'en recreer un.",
        ephemeral: true,
      });
      return;
    }

    const name = (interaction.options.getString("nom") ?? `🔊 Salon de ${member.displayName}`).trim().slice(0, 100);
    const limit = interaction.options.getInteger("limite");
    const description = interaction.options.getString("description");
    const allowedMembers: User[] = [];
    for (let i = 1; i <= MAX_ALLOWED_MEMBERS; i++) {
      const user = interaction.options.getUser(`membre${i}`);
      if (user) allowedMembers.push(user);
    }

    const nameViolation = await findChannelNameViolation(interaction.guild.id, name);
    if (nameViolation) {
      await interaction.reply({
        content: `Ce nom de salon n'est pas autorise (terme filtre : "${nameViolation}"). Choisis-en un autre.`,
        ephemeral: true,
      });
      return;
    }
    if (description) {
      const descriptionViolation = await findChannelNameViolation(interaction.guild.id, description);
      if (descriptionViolation) {
        await interaction.reply({
          content: `Cette description n'est pas autorisee (terme filtre : "${descriptionViolation}"). Choisis-en une autre.`,
          ephemeral: true,
        });
        return;
      }
    }

    await interaction.deferReply({ ephemeral: true });

    const everyoneId = interaction.guild.roles.everyone.id;
    const botId = interaction.guild.members.me?.id;
    const isPrivate = allowedMembers.length > 0;

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
          ...(isPrivate
            ? [
                { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
                ...(botId ? [{ id: botId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }] : []),
                ...allowedMembers.map((u) => ({ id: u.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] })),
              ]
            : []),
        ],
      })
      .catch(() => null);

    if (!channel) {
      await interaction.editReply("Impossible de creer le salon (verifie que j'ai la permission Gerer les salons).");
      return;
    }

    await prisma.tempVoiceChannel.create({ data: { guildId: interaction.guild.id, channelId: channel.id, ownerId: interaction.user.id } });
    await member.voice.setChannel(channel.id).catch(() => null);

    if (description) {
      // "Statut" du salon vocal (fonctionnalite Discord recente) - pas encore wrappee par
      // discord.js, d'ou l'appel REST direct. Best-effort : ne bloque jamais la commande.
      await interaction.client.rest.put(Routes.channelVoiceStatus(channel.id), { body: { status: description } }).catch(() => null);
    }

    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle("🔊 Salon vocal cree !")
      .addFields(
        { name: "Nom", value: name, inline: true },
        { name: "Limite", value: limit ? `${limit} membre(s)` : "Illimitee", inline: true },
        { name: "Acces", value: isPrivate ? allowedMembers.map((u) => `<@${u.id}>`).join(", ") : "Tout le monde", inline: true },
      );
    if (description) embed.addFields({ name: "Description", value: description });
    embed.setFooter({ text: "Renommage/parametres geres directement depuis Discord - le salon est supprime des qu'il se vide." });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
