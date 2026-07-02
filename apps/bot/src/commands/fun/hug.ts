import { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { generateHugImage } from "../../lib/hug-image.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("hug")
    .setDescription("Fais un calin a quelqu'un")
    .addUserOption((opt) => opt.setName("membre").setDescription("La personne a caliner").setRequired(true)),
  async execute(interaction) {
    const target = interaction.options.getUser("membre", true);

    if (target.id === interaction.user.id) {
      await interaction.reply("Un auto-calin, c'est permis aussi ! Prends soin de toi.");
      return;
    }

    await interaction.deferReply();

    const embed = new EmbedBuilder()
      .setColor(0xd4537e)
      .setDescription(`${interaction.user} envoie un calin tout doux a ${target} !`);

    try {
      const buffer = await generateHugImage(
        interaction.user.displayAvatarURL({ extension: "png", size: 256 }),
        target.displayAvatarURL({ extension: "png", size: 256 }),
      );
      const attachment = new AttachmentBuilder(buffer, { name: "calin.png" });
      embed.setImage("attachment://calin.png");
      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error) {
      console.error("Echec de la generation de l'image de calin", error);
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
