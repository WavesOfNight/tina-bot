import { prisma, findAutoModMatch } from "@tina/database";

export async function findBlacklistedWord(guildId: string, text: string): Promise<string | null> {
  const guildData = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guildData?.autoModLevel || guildData.autoModLevel === "OFF") return null;

  return findAutoModMatch(guildData.autoModLevel, text);
}
