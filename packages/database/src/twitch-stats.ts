import { prisma } from "./client.js";
import { MAX_LEVEL, XP_COOLDOWN_MS, levelFromXp, rollGainedXp } from "./xp.js";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function incrementTwitchDailyStat(field: "messages" | "commands" | "timeouts"): Promise<void> {
  const date = todayKey();
  await prisma.twitchDailyStat.upsert({
    where: { date },
    create: { date, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}

export async function getTwitchDailyStats(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceKey = since.toISOString().slice(0, 10);
  return prisma.twitchDailyStat.findMany({
    where: { date: { gte: sinceKey } },
    orderBy: { date: "asc" },
  });
}

export async function grantTwitchMessageXp(username: string): Promise<{ leveledUp: true; newLevel: number } | null> {
  const stat = await prisma.twitchChatterStat.upsert({
    where: { username },
    create: { username, messages: 1 },
    update: { messages: { increment: 1 }, lastSeenAt: new Date() },
  });

  const now = new Date();
  if (stat.lastXpAt && now.getTime() - stat.lastXpAt.getTime() < XP_COOLDOWN_MS) {
    return null;
  }

  const gained = rollGainedXp();
  const newXp = stat.xp + gained;
  const previousLevel = stat.level;
  const newLevel = Math.min(levelFromXp(newXp), MAX_LEVEL);

  await prisma.twitchChatterStat.update({
    where: { username },
    data: { xp: newXp, level: newLevel, lastXpAt: now },
  });

  if (newLevel > previousLevel) {
    return { leveledUp: true, newLevel };
  }
  return null;
}

export async function grantWatchtimeTick(username: string, minutes: number): Promise<void> {
  const stat = await prisma.twitchChatterStat.upsert({
    where: { username },
    create: { username, watchMinutes: minutes },
    update: { watchMinutes: { increment: minutes }, lastSeenAt: new Date() },
  });

  const gained = minutes * 2;
  const newXp = stat.xp + gained;
  const newLevel = Math.min(levelFromXp(newXp), MAX_LEVEL);

  await prisma.twitchChatterStat.update({ where: { username }, data: { xp: newXp, level: newLevel } });
}

export async function getTopTwitchChatters(limit = 10) {
  return prisma.twitchChatterStat.findMany({ orderBy: { messages: "desc" }, take: limit });
}

export async function getTwitchLeaderboard(limit = 5) {
  return prisma.twitchChatterStat.findMany({
    where: { xp: { gt: 0 } },
    orderBy: [{ level: "desc" }, { xp: "desc" }],
    take: limit,
  });
}

export async function getTwitchRank(username: string): Promise<{ xp: number; level: number; rank: number } | null> {
  const stat = await prisma.twitchChatterStat.findUnique({ where: { username } });
  if (!stat) return null;

  const higherCount = await prisma.twitchChatterStat.count({
    where: { OR: [{ level: { gt: stat.level } }, { level: stat.level, xp: { gt: stat.xp } }] },
  });

  return { xp: stat.xp, level: stat.level, rank: higherCount + 1 };
}

export async function getTopTwitchCommands(limit = 10) {
  return prisma.twitchCommand.findMany({ orderBy: { uses: "desc" }, take: limit, where: { uses: { gt: 0 } } });
}
