import "dotenv/config";

export const config = {
  devGuildId: process.env.DISCORD_DEV_GUILD_ID || null,
};
