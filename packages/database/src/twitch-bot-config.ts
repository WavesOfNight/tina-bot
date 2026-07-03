import { prisma } from "./client.js";
import { decryptSecret, encryptSecret } from "./crypto.js";

export interface ResolvedTwitchBotConfig {
  username: string;
  oauthToken: string;
  channelName: string;
  linkedGuildId: string | null;
  autoModLevel: string;
  prefix: string;
  enabled: boolean;
  updatedAt: Date;
}

export async function getTwitchBotConfig(): Promise<ResolvedTwitchBotConfig | null> {
  const record = await prisma.twitchBotConfig.findUnique({ where: { id: 1 } });
  if (!record || !record.username || !record.oauthTokenEncrypted || !record.channelName) return null;

  return {
    username: record.username,
    oauthToken: decryptSecret(record.oauthTokenEncrypted),
    channelName: record.channelName,
    linkedGuildId: record.linkedGuildId,
    autoModLevel: record.autoModLevel,
    prefix: record.prefix,
    enabled: record.enabled,
    updatedAt: record.updatedAt,
  };
}

export async function setTwitchBotAccount(username: string, oauthToken: string, channelName: string): Promise<void> {
  const oauthTokenEncrypted = encryptSecret(oauthToken);
  await prisma.twitchBotConfig.upsert({
    where: { id: 1 },
    create: { id: 1, username, oauthTokenEncrypted, channelName },
    update: { username, oauthTokenEncrypted, channelName },
  });
}

export async function setTwitchBotSettings(settings: {
  linkedGuildId?: string | null;
  autoModLevel?: string;
  prefix?: string;
  enabled?: boolean;
}): Promise<void> {
  await prisma.twitchBotConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...settings },
    update: settings,
  });
}
