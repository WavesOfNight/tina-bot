import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, type TextChannel } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";
import { buildReactionRoleMessagePayload } from "../../lib/reactionrole.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("reactionrole")
    .setDescription("Gere les messages de reaction-role")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Cree un nouveau message de reaction-role")
        .addStringOption((opt) => opt.setName("titre").setDescription("Titre du message").setRequired(true))
        .addChannelOption((opt) =>
          opt.setName("salon").setDescription("Salon de publication").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("addrole")
        .setDescription("Ajoute un role a un message de reaction-role existant")
        .addIntegerOption((opt) => opt.setName("message_id").setDescription("Identifiant du message (donne a la creation)").setRequired(true))
        .addRoleOption((opt) => opt.setName("role").setDescription("Role a attribuer").setRequired(true))
        .addStringOption((opt) => opt.setName("label").setDescription("Texte du bouton").setRequired(true))
        .addStringOption((opt) => opt.setName("emoji").setDescription("Emoji du bouton")),
    ),
  async execute(interaction) {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });

    if (sub === "create") {
      const title = interaction.options.getString("titre", true);
      const channel = interaction.options.getChannel("salon", true) as TextChannel;

      const record = await prisma.reactionRoleMessage.create({ data: { guildId, channelId: channel.id, title } });
      const payload = await buildReactionRoleMessagePayload(record.id);
      const message = await channel.send(payload!);
      await prisma.reactionRoleMessage.update({ where: { id: record.id }, data: { messageId: message.id, dirty: false } });

      await interaction.reply({
        content: `Message de reaction-role cree (id **${record.id}**). Utilise \`/reactionrole addrole\` pour y ajouter des roles.`,
        ephemeral: true,
      });
      return;
    }

    const messageId = interaction.options.getInteger("message_id", true);
    const role = interaction.options.getRole("role", true);
    const label = interaction.options.getString("label", true);
    const emoji = interaction.options.getString("emoji");

    const record = await prisma.reactionRoleMessage.findFirst({ where: { id: messageId, guildId } });
    if (!record) {
      await interaction.reply({ content: "Message de reaction-role introuvable.", ephemeral: true });
      return;
    }

    await prisma.reactionRoleButton.upsert({
      where: { messageId_fk_roleId: { messageId_fk: record.id, roleId: role.id } },
      create: { messageId_fk: record.id, roleId: role.id, label, emoji },
      update: { label, emoji },
    });

    const payload = await buildReactionRoleMessagePayload(record.id);
    if (record.messageId && record.channelId) {
      const channel = (await interaction.guild.channels.fetch(record.channelId)) as TextChannel | null;
      const message = await channel?.messages.fetch(record.messageId).catch(() => null);
      await message?.edit(payload!);
    }

    await interaction.reply({ content: `Role ${role} ajoute au message #${record.id}.`, ephemeral: true });
  },
};

export default command;
