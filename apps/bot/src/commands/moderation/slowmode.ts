import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, type TextChannel } from "discord.js";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Regle le mode lent d'un salon")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((opt) =>
      opt.setName("secondes").setDescription("Delai entre chaque message (0 pour desactiver)").setRequired(true).setMinValue(0).setMaxValue(21600),
    )
    .addChannelOption((opt) =>
      opt.setName("salon").setDescription("Le salon a modifier (par defaut : ce salon)").addChannelTypes(ChannelType.GuildText),
    ),
  async execute(interaction) {
    const seconds = interaction.options.getInteger("secondes", true);
    const channel = (interaction.options.getChannel("salon") as TextChannel | null) ?? (interaction.channel as TextChannel);

    await channel.setRateLimitPerUser(seconds);
    await interaction.reply(seconds === 0 ? `Mode lent desactive sur ${channel}.` : `Mode lent regle a ${seconds}s sur ${channel}.`);
  },
};

export default command;
