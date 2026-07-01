import { PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Supprime plusieurs messages d'un coup")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      opt.setName("nombre").setDescription("Nombre de messages a supprimer (1-100)").setRequired(true).setMinValue(1).setMaxValue(100),
    ),
  async execute(interaction) {
    if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: "Cette commande fonctionne uniquement dans un salon textuel.", ephemeral: true });
      return;
    }
    const amount = interaction.options.getInteger("nombre", true);

    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `${deleted.size} message(s) supprime(s).`, ephemeral: true });
  },
};

export default command;
