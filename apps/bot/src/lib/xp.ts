import { prisma } from "@tina/database";

export const MAX_LEVEL = 50;
const XP_COOLDOWN_MS = 60_000;
const XP_MIN = 15;
const XP_MAX = 25;

export function xpToReachLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

export function levelFromXp(totalXp: number): number {
  let level = 0;
  let cumulative = 0;
  while (level < MAX_LEVEL) {
    cumulative += xpToReachLevel(level);
    if (totalXp < cumulative) break;
    level++;
  }
  return level;
}

export function xpProgress(totalXp: number, level: number): { current: number; needed: number } {
  let cumulative = 0;
  for (let i = 0; i < level; i++) cumulative += xpToReachLevel(i);
  return { current: totalXp - cumulative, needed: xpToReachLevel(level) };
}

export async function grantMessageXp(guildId: string, userId: string) {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });

  const member = await prisma.member.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId },
    update: {},
  });

  const now = new Date();
  if (member.lastXpAt && now.getTime() - member.lastXpAt.getTime() < XP_COOLDOWN_MS) {
    await prisma.member.update({
      where: { guildId_userId: { guildId, userId } },
      data: { messages: { increment: 1 } },
    });
    return null;
  }

  const gained = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
  const newXp = member.xp + gained;
  const previousLevel = member.level;
  const newLevel = Math.min(levelFromXp(newXp), MAX_LEVEL);

  await prisma.member.update({
    where: { guildId_userId: { guildId, userId } },
    data: { xp: newXp, level: newLevel, lastXpAt: now, messages: { increment: 1 } },
  });

  if (newLevel > previousLevel) {
    return { leveledUp: true, newLevel };
  }
  return null;
}
