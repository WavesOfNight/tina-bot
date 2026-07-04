import { prisma } from "./client.js";

export async function getActiveTwitchGiveaway() {
  return prisma.twitchGiveaway.findFirst({
    where: { status: "ACTIVE" },
    include: { entries: true },
  });
}

export async function getTwitchGiveawayHistory(limit = 20) {
  return prisma.twitchGiveaway.findMany({
    where: { status: { not: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { _count: { select: { entries: true } } },
  });
}

export async function startTwitchGiveaway(keyword: string, prize: string): Promise<void> {
  const existing = await prisma.twitchGiveaway.findFirst({ where: { status: "ACTIVE" } });
  if (existing) throw new Error("Un giveaway est deja en cours.");
  await prisma.twitchGiveaway.create({ data: { keyword, prize } });
}

export async function addTwitchGiveawayEntry(giveawayId: number, username: string): Promise<boolean> {
  try {
    await prisma.twitchGiveawayEntry.create({ data: { giveawayId, username } });
    return true;
  } catch {
    return false;
  }
}

export async function endTwitchGiveaway(id: number): Promise<string | null> {
  const giveaway = await prisma.twitchGiveaway.findUnique({ where: { id }, include: { entries: true } });
  if (!giveaway || giveaway.entries.length === 0) {
    await prisma.twitchGiveaway.update({ where: { id }, data: { status: "ENDED", endedAt: new Date() } });
    return null;
  }
  const winner = giveaway.entries[Math.floor(Math.random() * giveaway.entries.length)];
  await prisma.twitchGiveaway.update({
    where: { id },
    data: { status: "ENDED", endedAt: new Date(), winnerUsername: winner.username },
  });
  return winner.username;
}

export async function cancelTwitchGiveaway(id: number): Promise<void> {
  await prisma.twitchGiveaway.update({ where: { id }, data: { status: "CANCELLED", endedAt: new Date() } });
}
