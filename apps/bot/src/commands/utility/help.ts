import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";

const CATEGORIES = [
  {
    name: "🛠️ Utilitaires",
    value: "`/ping` `/userinfo` `/serverinfo` `/avatar` `/roleinfo` `/poll` `/remindme` `/8ball`",
  },
  {
    name: "🎉 Fun",
    value: "`/hello` `/hug`",
  },
  {
    name: "🎮 Jeux en duel",
    value: "`/morpion` `/puissance4` `/chifumi` `/loto` — ajoute `manches:3` ou `manches:5` pour un match !",
  },
  {
    name: "👥 Jeux en groupe",
    value: "`/trivia` `/bombe` `/histoire` `/combattre`",
  },
  {
    name: "🏆 Niveaux",
    value: "`/rank` `/leaderboard`",
  },
  {
    name: "🛡️ Moderation",
    value: "`/warn` `/warnings` `/mute` `/unmute` `/kick` `/ban` `/unban` `/clear` `/slowmode` `/nickname` `/say`",
  },
  {
    name: "🎁 Serveur",
    value: "`/giveaway` `/reactionrole` `/customcommand`",
  },
];

const command: Command = {
  data: new SlashCommandBuilder().setName("help").setDescription("Liste toutes les commandes de Tina [BOT]"),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setAuthor({ name: "Tina [BOT]", iconURL: interaction.client.user?.displayAvatarURL() })
      .setTitle("Toutes les commandes")
      .setDescription(
        "Tape `/` dans le chat pour voir la description et les options completes de chaque commande. Tout est aussi configurable depuis le panel web.",
      )
      .addFields(...CATEGORIES)
      .setFooter({ text: "Panel web disponible pour tout configurer sans code." })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
