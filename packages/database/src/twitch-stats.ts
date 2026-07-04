import { prisma } from "./client.js";

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

export async function incrementTwitchChatterStat(username: string): Promise<void> {
  await prisma.twitchChatterStat.upsert({
    where: { username },
    create: { username, messages: 1 },
    update: { messages: { increment: 1 }, lastSeenAt: new Date() },
  });
}

export async function getTopTwitchChatters(limit = 10) {
  return prisma.twitchChatterStat.findMany({ orderBy: { messages: "desc" }, take: limit });
}

export async function getTopTwitchCommands(limit = 10) {
  return prisma.twitchCommand.findMany({ orderBy: { uses: "desc" }, take: limit, where: { uses: { gt: 0 } } });
}
