import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder().setName("hello").setDescription("Dit bonjour a Tina [BOT]"),
  async execute(interaction) {
    const greetings = [
      "Coucou ! Ravie de te voir par ici.",
      "Salut salut ! J'espere que tu passes une bonne journee.",
      "Hello ! Tina est de service.",
    ];
    const pick = greetings[Math.floor(Math.random() * greetings.length)];
    await interaction.reply(`${pick} <@${interaction.user.id}>`);
  },
};

export default command;
