import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("histoire")
    .setDescription("Ecrivez une histoire collaborative, un mot a la fois")
    .addSubcommand((sub) =>
      sub
        .setName("mot")
        .setDescription("Ajoute un mot a l'histoire")
        .addStringOption((opt) => opt.setName("mot").setDescription("Un seul mot").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("voir").setDescription("Affiche l'histoire en cours"))
    .addSubcommand((sub) => sub.setName("reset").setDescription("Efface l'histoire et recommence")),
  async execute(interaction) {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });

    if (sub === "reset") {
      await prisma.collabStory.upsert({
        where: { guildId },
        create: { guildId, content: "", lastUserId: null },
        update: { content: "", lastUserId: null },
      });
      await interaction.reply("L'histoire a ete effacee. Utilise `/histoire mot` pour en recommencer une !");
      return;
    }

    if (sub === "voir") {
      const story = await prisma.collabStory.findUnique({ where: { guildId } });
      const embed = new EmbedBuilder()
        .setColor(0x7f77dd)
        .setTitle("Histoire collaborative")
        .setDescription(story?.content ? story.content : "Aucune histoire pour le moment. Utilise `/histoire mot` !");
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const rawWord = interaction.options.getString("mot", true).trim();
    if (/\s/.test(rawWord) || rawWord.length === 0) {
      await interaction.reply({ content: "Un seul mot a la fois, sans espace !", ephemeral: true });
      return;
    }

    const story = await prisma.collabStory.upsert({
      where: { guildId },
      create: { guildId, content: "", lastUserId: null },
      update: {},
    });

    if (story.lastUserId === interaction.user.id) {
      await interaction.reply({ content: "Tu ne peux pas ajouter deux mots d'affilee, laisse quelqu'un d'autre jouer !", ephemeral: true });
      return;
    }

    const newContent = story.content ? `${story.content} ${rawWord}` : rawWord;
    await prisma.collabStory.update({ where: { guildId }, data: { content: newContent, lastUserId: interaction.user.id } });

    await interaction.reply(`✍️ **${rawWord}** ajoute par ${interaction.user} !\n\n> ${newContent}`);
  },
};

export default command;
