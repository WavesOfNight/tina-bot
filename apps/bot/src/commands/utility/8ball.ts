import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";

const ANSWERS = [
  "C'est certain.",
  "Sans aucun doute.",
  "Oui, definitivement.",
  "Tu peux compter dessus.",
  "Probablement.",
  "Les signes indiquent oui.",
  "Reponse floue, retente.",
  "Redemande plus tard.",
  "Mieux vaut ne pas te le dire maintenant.",
  "Impossible de predire pour le moment.",
  "N'y compte pas.",
  "Ma reponse est non.",
  "Mes sources disent non.",
  "Les perspectives ne sont pas bonnes.",
  "Tres douteux.",
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("Pose une question a la boule magique")
    .addStringOption((opt) => opt.setName("question").setDescription("Ta question").setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString("question", true);
    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];

    const embed = new EmbedBuilder()
      .setColor(0x26215c)
      .setTitle("🎱 Boule magique")
      .addFields({ name: "Question", value: question }, { name: "Reponse", value: answer });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
