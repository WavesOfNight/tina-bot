import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { transferBalance } from "@tina/database";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Donne des pieces a un autre membre")
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a qui donner").setRequired(true))
    .addIntegerOption((opt) => opt.setName("montant").setDescription("Le nombre de pieces a donner").setRequired(true).setMinValue(1)),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre", true);
    const amount = interaction.options.getInteger("montant", true);

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "Tu ne peux pas te payer toi-meme !", ephemeral: true });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: "Tu ne peux pas payer un bot.", ephemeral: true });
      return;
    }

    const ok = await transferBalance(interaction.guild.id, interaction.user.id, target.id, amount);
    if (!ok) {
      await interaction.reply({ content: "Tu n'as pas assez de pieces pour ca.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xf5c451)
      .setDescription(`💸 ${interaction.user} a donne **${amount}** piece${amount > 1 ? "s" : ""} a ${target} !`);
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
