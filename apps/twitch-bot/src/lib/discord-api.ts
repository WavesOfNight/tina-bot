import { getBotConfig, prisma } from "@tina/database";

async function getDiscordDisplayName(token: string, guildId: string, userId: string): Promise<string | null> {
  const res = await fetch(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${token}` },
  }).catch(() => null);
  if (!res || !res.ok) return null;

  const data = (await res.json()) as { nick?: string | null; user?: { username?: string; global_name?: string | null } };
  return data.nick || data.user?.global_name || data.user?.username || null;
}

export async function getDiscordInviteUrl(linkedGuildId: string | null): Promise<string | null> {
  if (!linkedGuildId) return null;
  const guild = await prisma.guild.findUnique({ where: { id: linkedGuildId } });
  if (!guild?.permanentInviteCode) return null;
  return `https://discord.gg/${guild.permanentInviteCode}`;
}

export async function getDiscordLeaderboardText(linkedGuildId: string | null, limit = 5): Promise<string | null> {
  if (!linkedGuildId) return null;

  const [botConfig, members] = await Promise.all([
    getBotConfig(),
    prisma.member.findMany({ where: { guildId: linkedGuildId }, orderBy: { xp: "desc" }, take: limit }),
  ]);
  if (!botConfig || members.length === 0) return null;

  const entries = await Promise.all(
    members.map(async (member, index) => {
      const name = (await getDiscordDisplayName(botConfig.token, linkedGuildId, member.userId).catch(() => null)) ?? "quelqu'un";
      return `${index + 1}. ${name} (Niv. ${member.level})`;
    }),
  );

  return entries.join(" | ");
}
