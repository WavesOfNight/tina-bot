import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from "discord.js";
import { prisma } from "@tina/database";
import type { ButtonHandler } from "../types.js";

const handler: ButtonHandler = {
  prefix: "ticket",
  async execute(interaction, parts) {
    const [action] = parts;
    if (!interaction.guild || !interaction.member) return;

    const guildRecord = await prisma.guild.findUnique({ where: { id: interaction.guild.id } });

    if (action === "open") {
      if (!guildRecord?.ticketCategoryId) {
        await interaction.reply({ content: "Le systeme de tickets n'est pas configure.", ephemeral: true });
        return;
      }

      const existing = await prisma.ticket.findFirst({
        where: { guildId: interaction.guild.id, userId: interaction.user.id, status: "OPEN" },
      });
      if (existing) {
        await interaction.reply({ content: `Tu as deja un ticket ouvert : <#${existing.channelId}>`, ephemeral: true });
        return;
      }

      const overwrites = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ];
      if (guildRecord.ticketSupportRoleId) {
        overwrites.push({
          id: guildRecord.ticketSupportRoleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        });
      }

      const channel = await interaction.guild.channels
        .create({
          name: `ticket-${interaction.user.username}`.slice(0, 90),
          type: ChannelType.GuildText,
          parent: guildRecord.ticketCategoryId,
          permissionOverwrites: overwrites,
        })
        .catch(() => null);

      if (!channel) {
        await interaction.reply({ content: "Impossible de creer le salon de ticket (verifie la categorie configuree).", ephemeral: true });
        return;
      }

      await prisma.ticket.create({ data: { guildId: interaction.guild.id, channelId: channel.id, userId: interaction.user.id } });

      const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ticket:close").setLabel("Fermer le ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger),
      );
      await channel
        .send({
          content: `${interaction.user} a ouvert un ticket.${guildRecord.ticketSupportRoleId ? ` <@&${guildRecord.ticketSupportRoleId}>` : ""}`,
          components: [closeRow],
        })
        .catch(() => null);

      await interaction.reply({ content: `Ticket cree : ${channel}`, ephemeral: true });
      return;
    }

    if (action === "close") {
      const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId ?? "", status: "OPEN" } });
      if (!ticket) {
        await interaction.reply({ content: "Ce salon n'est pas un ticket ouvert.", ephemeral: true });
        return;
      }

      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "CLOSED", closedAt: new Date() } });
      await interaction.reply({ content: "Ticket ferme, ce salon sera supprime dans 5 secondes." });
      setTimeout(() => {
        interaction.channel?.delete().catch(() => null);
      }, 5000);
    }
  },
};

export default handler;
