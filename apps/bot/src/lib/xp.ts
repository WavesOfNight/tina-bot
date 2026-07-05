import { prisma, MAX_LEVEL, XP_COOLDOWN_MS, levelFromXp, rollGainedXp } from "@tina/database";

export { MAX_LEVEL, xpToReachLevel, levelFromXp, xpProgress } from "@tina/database";

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

  const gained = rollGainedXp();
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
