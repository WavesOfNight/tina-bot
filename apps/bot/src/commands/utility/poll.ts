import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { polls, pollResultsText } from "../../lib/poll-store.js";

const LETTERS = ["🇦", "🇧", "🇨", "🇩"];

export function buildPollComponents(pollId: string, optionCount: number, disabled = false) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (let i = 0; i < optionCount; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll:${pollId}:${i}`)
        .setLabel(LETTERS[i])
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
    );
  }
  return [row];
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Cree un sondage avec jusqu'a 4 options")
    .addStringOption((opt) => opt.setName("question").setDescription("La question du sondage").setRequired(true))
    .addStringOption((opt) => opt.setName("option1").setDescription("Premiere option").setRequired(true))
    .addStringOption((opt) => opt.setName("option2").setDescription("Deuxieme option").setRequired(true))
    .addStringOption((opt) => opt.setName("option3").setDescription("Troisieme option"))
    .addStringOption((opt) => opt.setName("option4").setDescription("Quatrieme option")),
  async execute(interaction) {
    const question = interaction.options.getString("question", true);
    const options = [
      interaction.options.getString("option1", true),
      interaction.options.getString("option2", true),
      interaction.options.getString("option3"),
      interaction.options.getString("option4"),
    ].filter((o): o is string => Boolean(o));

    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle(`📊 ${question}`)
      .setDescription(options.map((o, i) => `${LETTERS[i]} ${o}`).join("\n"))
      .setFooter({ text: `Sondage lance par ${interaction.user.username}` });

    const reply = await interaction.reply({ embeds: [embed], components: buildPollComponents("pending", options.length), fetchReply: true });
    const pollId = reply.id;
    polls.set(pollId, { question, options, votes: new Map() });

    await interaction.editReply({ components: buildPollComponents(pollId, options.length) });
  },
};

export default command;
export { pollResultsText };
