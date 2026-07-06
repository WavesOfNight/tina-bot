import { prisma } from "./client.js";
import { decryptSecret, encryptSecret } from "./crypto.js";

export interface ResolvedTwitchBotConfig {
  username: string;
  channelName: string;
  clientId: string | null;
  clientSecret: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  linkedGuildId: string | null;
  autoModLevel: string;
  prefix: string;
  enabled: boolean;
  filterLinksEnabled: boolean;
  linkWhitelist: string[];
  filterCapsEnabled: boolean;
  filterEmotesEnabled: boolean;
  maxEmotes: number;
  filterSymbolsEnabled: boolean;
  filterRepetitionEnabled: boolean;
  filterSharedChatEnabled: boolean;
  raidShoutoutEnabled: boolean;
  announceFollows: boolean;
  announceSubs: boolean;
  lastKnownFollowAt: Date | null;
  lastKnownSubCount: number | null;
  updatedAt: Date;
}

export async function getTwitchBotConfig(): Promise<ResolvedTwitchBotConfig | null> {
  const record = await prisma.twitchBotConfig.findUnique({ where: { id: 1 } });
  if (!record || !record.username || !record.channelName) return null;

  return {
    username: record.username,
    channelName: record.channelName,
    clientId: record.clientId,
    clientSecret: record.clientSecretEncrypted ? decryptSecret(record.clientSecretEncrypted) : null,
    accessToken: record.accessTokenEncrypted ? decryptSecret(record.accessTokenEncrypted) : null,
    refreshToken: record.refreshTokenEncrypted ? decryptSecret(record.refreshTokenEncrypted) : null,
    tokenExpiresAt: record.tokenExpiresAt,
    linkedGuildId: record.linkedGuildId,
    autoModLevel: record.autoModLevel,
    prefix: record.prefix,
    enabled: record.enabled,
    filterLinksEnabled: record.filterLinksEnabled,
    linkWhitelist: record.linkWhitelist
      ? record.linkWhitelist.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    filterCapsEnabled: record.filterCapsEnabled,
    filterEmotesEnabled: record.filterEmotesEnabled,
    maxEmotes: record.maxEmotes,
    filterSymbolsEnabled: record.filterSymbolsEnabled,
    filterRepetitionEnabled: record.filterRepetitionEnabled,
    filterSharedChatEnabled: record.filterSharedChatEnabled,
    raidShoutoutEnabled: record.raidShoutoutEnabled,
    announceFollows: record.announceFollows,
    announceSubs: record.announceSubs,
    lastKnownFollowAt: record.lastKnownFollowAt,
    lastKnownSubCount: record.lastKnownSubCount,
    updatedAt: record.updatedAt,
  };
}

export async function setTwitchBotAccount(username: string, channelName: string): Promise<void> {
  await prisma.twitchBotConfig.upsert({
    where: { id: 1 },
    create: { id: 1, username, channelName },
    update: { username, channelName },
  });
}

export async function getTwitchBotAppCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
  const record = await prisma.twitchBotConfig.findUnique({ where: { id: 1 } });
  if (!record?.clientId || !record.clientSecretEncrypted) return null;
  return { clientId: record.clientId, clientSecret: decryptSecret(record.clientSecretEncrypted) };
}

export async function setTwitchBotApp(clientId: string, clientSecret: string): Promise<void> {
  const clientSecretEncrypted = encryptSecret(clientSecret);
  await prisma.twitchBotConfig.upsert({
    where: { id: 1 },
    create: { id: 1, clientId, clientSecretEncrypted },
    update: { clientId, clientSecretEncrypted },
  });
}

export async function saveTwitchBotOAuthTokens(accessToken: string, refreshToken: string, expiresInSeconds: number): Promise<void> {
  const accessTokenEncrypted = encryptSecret(accessToken);
  const refreshTokenEncrypted = encryptSecret(refreshToken);
  const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  await prisma.twitchBotConfig.upsert({
    where: { id: 1 },
    create: { id: 1, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt },
    update: { accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt },
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

export async function setTwitchEngagement(settings: {
  raidShoutoutEnabled: boolean;
  announceFollows: boolean;
  announceSubs: boolean;
}): Promise<void> {
  await prisma.twitchBotConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...settings },
    update: settings,
  });
}

export async function setTwitchFollowSubTracking(settings: { lastKnownFollowAt?: Date; lastKnownSubCount?: number }): Promise<void> {
  await prisma.twitchBotConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...settings },
    update: settings,
  });
}

export async function setTwitchModeration(settings: {
  filterLinksEnabled: boolean;
  linkWhitelist: string;
  filterCapsEnabled: boolean;
  filterEmotesEnabled: boolean;
  maxEmotes: number;
  filterSymbolsEnabled: boolean;
  filterRepetitionEnabled: boolean;
  filterSharedChatEnabled: boolean;
}): Promise<void> {
  await prisma.twitchBotConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...settings },
    update: settings,
  });
}
