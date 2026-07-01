import { prisma } from "@tina/database";

export async function findAutoResponseMatch(guildId: string, content: string) {
  const responses = await prisma.autoResponse.findMany({ where: { guildId, enabled: true } });
  const normalized = content.trim().toLowerCase();

  for (const response of responses) {
    const trigger = response.trigger.trim().toLowerCase();
    if (!trigger) continue;

    const isMatch =
      response.matchType === "EXACT" ? normalized === trigger : normalized.includes(trigger);

    if (isMatch) return response;
  }

  return null;
}
