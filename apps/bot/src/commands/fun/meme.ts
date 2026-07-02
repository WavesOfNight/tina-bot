import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";

interface MemeApiResponse {
  title: string;
  url: string;
  postLink: string;
  subreddit: string;
  author: string;
  ups: number;
  nsfw: boolean;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("meme")
    .setDescription("Affiche un meme aleatoire")
    .addStringOption((opt) => opt.setName("subreddit").setDescription("Subreddit specifique (optionnel, ex: memes)")),
  async execute(interaction) {
    const subreddit = interaction.options.getString("subreddit");
    const url = subreddit ? `https://meme-api.com/gimme/${encodeURIComponent(subreddit)}` : "https://meme-api.com/gimme";

    await interaction.deferReply();

    const res = await fetch(url).catch(() => null);
    if (!res || !res.ok) {
      await interaction.editReply("Impossible de recuperer un meme pour le moment, retente plus tard.");
      return;
    }

    const meme = (await res.json()) as MemeApiResponse;
    if (!meme.url || meme.nsfw) {
      await interaction.editReply("Aucun meme adapte trouve, retente !");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x7f77dd)
      .setTitle(meme.title)
      .setURL(meme.postLink)
      .setImage(meme.url)
      .setFooter({ text: `r/${meme.subreddit} - 👍 ${meme.ups}` });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
