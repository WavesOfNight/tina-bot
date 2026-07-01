import { prisma } from "./client.js";
import { decryptSecret, encryptSecret } from "./crypto.js";

export interface ResolvedBotConfig {
  clientId: string;
  token: string;
  clientSecret: string | null;
  updatedAt: Date;
}

export async function getBotConfig(): Promise<ResolvedBotConfig | null> {
  const record = await prisma.botConfig.findUnique({ where: { id: 1 } });
  if (!record) return null;
  return {
    clientId: record.clientId,
    token: decryptSecret(record.tokenEncrypted),
    clientSecret: record.clientSecretEncrypted ? decryptSecret(record.clientSecretEncrypted) : null,
    updatedAt: record.updatedAt,
  };
}

export async function setBotConfig(clientId: string, token: string, clientSecret?: string | null): Promise<void> {
  const tokenEncrypted = encryptSecret(token);
  const clientSecretEncrypted = clientSecret ? encryptSecret(clientSecret) : undefined;

  await prisma.botConfig.upsert({
    where: { id: 1 },
    create: { id: 1, clientId, tokenEncrypted, clientSecretEncrypted: clientSecretEncrypted ?? null },
    update: { clientId, tokenEncrypted, ...(clientSecretEncrypted !== undefined ? { clientSecretEncrypted } : {}) },
  });
}
