import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, type TextChannel } from "discord.js";
import type { Command } from "../../types.js";
import { findBlacklistedWord } from "../../lib/blacklist.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Fait envoyer un message au bot (annonce)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((opt) => opt.setName("message").setDescription("Le message a envoyer").setRequired(true))
    .addChannelOption((opt) =>
      opt.setName("salon").setDescription("Le salon cible (par defaut : ce salon)").addChannelTypes(ChannelType.GuildText),
    ),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const message = interaction.options.getString("message", true);
    const channel = (interaction.options.getChannel("salon") as TextChannel | null) ?? (interaction.channel as TextChannel);

    const blacklistedWord = await findBlacklistedWord(interaction.guildId, message);
    if (blacklistedWord) {
      await interaction.reply({
        content: `Message bloque : contient un mot filtre par la moderation automatique ("${blacklistedWord}").`,
        ephemeral: true,
      });
      return;
    }

    await channel.send(message);
    await interaction.reply({ content: `Message envoye dans ${channel}.`, ephemeral: true });
  },
};

export default command;
