import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { chifumiDuels } from "../../lib/chifumi-store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("chifumi")
    .setDescription("Defie quelqu'un a pierre-feuille-ciseaux")
    .addUserOption((opt) => opt.setName("adversaire").setDescription("Ton adversaire").setRequired(true)),
  async execute(interaction) {
    const opponent = interaction.options.getUser("adversaire", true);

    if (opponent.bot) {
      await interaction.reply({ content: "Tu ne peux pas defier un bot.", ephemeral: true });
      return;
    }
    if (opponent.id === interaction.user.id) {
      await interaction.reply({ content: "Il te faut un adversaire different de toi-meme.", ephemeral: true });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("chifumi:open:pending").setLabel("Faire ton choix").setEmoji("🤜").setStyle(ButtonStyle.Primary),
    );

    const reply = await interaction.reply({
      content: `${interaction.user} defie ${opponent} a pierre-feuille-ciseaux ! Cliquez pour faire votre choix (en prive).`,
      components: [row],
      fetchReply: true,
    });

    const duelId = reply.id;
    chifumiDuels.set(duelId, {
      players: [interaction.user.id, opponent.id],
      choices: {},
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      messageId: reply.id,
    });

    row.components[0].setCustomId(`chifumi:open:${duelId}`);
    await interaction.editReply({ components: [row] });
  },
};

export default command;
