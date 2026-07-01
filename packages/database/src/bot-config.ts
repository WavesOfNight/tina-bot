import { prisma } from "./client.js";
import { decryptSecret, encryptSecret } from "./crypto.js";

export interface ResolvedBotConfig {
  clientId: string;
  token: string;
  updatedAt: Date;
}

export async function getBotConfig(): Promise<ResolvedBotConfig | null> {
  const record = await prisma.botConfig.findUnique({ where: { id: 1 } });
  if (!record) return null;
  return { clientId: record.clientId, token: decryptSecret(record.tokenEncrypted), updatedAt: record.updatedAt };
}

export async function setBotConfig(clientId: string, token: string): Promise<void> {
  const tokenEncrypted = encryptSecret(token);
  await prisma.botConfig.upsert({
    where: { id: 1 },
    create: { id: 1, clientId, tokenEncrypted },
    update: { clientId, tokenEncrypted },
  });
}
