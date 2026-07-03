import { getBotConfig, prisma } from "@tina/database";

export async function sendDiscordLog(linkedGuildId: string | null, message: string): Promise<void> {
  if (!linkedGuildId) return;

  const [botConfig, guild] = await Promise.all([
    getBotConfig(),
    prisma.guild.findUnique({ where: { id: linkedGuildId } }),
  ]);
  if (!botConfig || !guild?.modLogChannelId) return;

  await fetch(`https://discord.com/api/channels/${guild.modLogChannelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${botConfig.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  }).catch((error) => console.error("Erreur lors de l'envoi du log Discord depuis Twitch", error));
}
