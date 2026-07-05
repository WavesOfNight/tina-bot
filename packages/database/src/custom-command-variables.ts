import { prisma } from "./client.js";

export async function getGuildVariables(guildId: string): Promise<Record<string, string>> {
  const rows = await prisma.customCommandVariable.findMany({ where: { guildId } });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.name] = row.value;
  return map;
}

export async function setGuildVariable(guildId: string, name: string, value: string): Promise<void> {
  await prisma.customCommandVariable.upsert({
    where: { guildId_name: { guildId, name } },
    create: { guildId, name, value },
    update: { value },
  });
}
