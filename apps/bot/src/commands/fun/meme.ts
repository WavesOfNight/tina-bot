import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { findAutoModMatch } from "@tina/database";

interface MemeApiResponse {
  title: string;
  url: string;
  postLink: string;
  subreddit: string;
  author: string;
  ups: number;
  nsfw: boolean;
  spoiler?: boolean;
}

// Subreddits francophones utilises quand aucun n'est precise.
const SAFE_SUBREDDITS = ["rance", "MemesFR", "france"];
const MAX_ATTEMPTS = 5;

function isClean(meme: MemeApiResponse): boolean {
  if (!meme.url || meme.nsfw || meme.spoiler) return false;
  return !findAutoModMatch("MEDIUM", `${meme.title} ${meme.subreddit}`);
}

async function fetchMeme(subreddit: string | null): Promise<MemeApiResponse | null> {
  const target = subreddit ?? SAFE_SUBREDDITS[Math.floor(Math.random() * SAFE_SUBREDDITS.length)];
  const res = await fetch(`https://meme-api.com/gimme/${encodeURIComponent(target)}`).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json().catch(() => null)) as MemeApiResponse | null;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("meme")
    .setDescription("Affiche un meme aleatoire (filtre)")
    .addStringOption((opt) => opt.setName("subreddit").setDescription("Subreddit specifique (optionnel, ex: memes)")),
  async execute(interaction) {
    const subreddit = interaction.options.getString("subreddit");

    await interaction.deferReply();

    let meme: MemeApiResponse | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = await fetchMeme(subreddit);
      if (candidate && isClean(candidate)) {
        meme = candidate;
        break;
      }
    }

    if (!meme) {
      await interaction.editReply("Aucun meme adapte trouve pour le moment, retente !");
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
