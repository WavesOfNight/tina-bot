import { prisma } from "./client.js";

export async function getBalance(guildId: string, userId: string): Promise<number> {
  const member = await prisma.member.findUnique({ where: { guildId_userId: { guildId, userId } } });
  return member?.balance ?? 0;
}

export async function adjustBalance(guildId: string, userId: string, delta: number): Promise<number> {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });

  const member = await prisma.member.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId, balance: Math.max(0, delta) },
    update: { balance: { increment: delta } },
  });

  if (member.balance < 0) {
    const corrected = await prisma.member.update({
      where: { guildId_userId: { guildId, userId } },
      data: { balance: 0 },
    });
    return corrected.balance;
  }

  return member.balance;
}

export async function transferBalance(
  guildId: string,
  fromUserId: string,
  toUserId: string,
  amount: number,
): Promise<boolean> {
  if (amount <= 0) return false;

  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });

  const sender = await prisma.member.upsert({
    where: { guildId_userId: { guildId, userId: fromUserId } },
    create: { guildId, userId: fromUserId },
    update: {},
  });
  if (sender.balance < amount) return false;

  await prisma.$transaction([
    prisma.member.update({ where: { guildId_userId: { guildId, userId: fromUserId } }, data: { balance: { decrement: amount } } }),
    prisma.member.upsert({
      where: { guildId_userId: { guildId, userId: toUserId } },
      create: { guildId, userId: toUserId, balance: amount },
      update: { balance: { increment: amount } },
    }),
  ]);
  return true;
}

export async function getEconomyLeaderboard(guildId: string, limit = 10) {
  return prisma.member.findMany({ where: { guildId, balance: { gt: 0 } }, orderBy: { balance: "desc" }, take: limit });
}
