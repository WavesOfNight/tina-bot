import { EmbedBuilder } from "discord.js";
import type { ButtonHandler } from "../types.js";
import { polls, pollResultsText } from "../lib/poll-store.js";
import { buildPollComponents } from "../commands/utility/poll.js";

const LETTERS = ["🇦", "🇧", "🇨", "🇩"];

const handler: ButtonHandler = {
  prefix: "poll",
  async execute(interaction, parts) {
    const [pollId, indexStr] = parts;
    const poll = polls.get(pollId);
    if (!poll) {
      await interaction.reply({ content: "Ce sondage n'existe plus.", ephemeral: true });
      return;
    }

    const optionIndex = Number(indexStr);
    poll.votes.set(interaction.user.id, optionIndex);

    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle(`📊 ${poll.question}`)
      .setDescription(pollResultsText(poll))
      .setFooter({ text: `${poll.votes.size} participant(s)` });

    await interaction.update({ embeds: [embed], components: buildPollComponents(pollId, poll.options.length) });
  },
};

export default handler;
