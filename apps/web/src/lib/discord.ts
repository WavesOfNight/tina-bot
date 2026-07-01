import { getBotConfig } from "@tina/database";

export interface BotGuild {
  id: string;
  name: string;
  icon: string | null;
}

export async function getBotGuilds(): Promise<BotGuild[]> {
  const config = await getBotConfig();
  if (!config) return [];

  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bot ${config.token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const guilds: BotGuild[] = await res.json();
  return guilds;
}

export async function getGuildInfo(guildId: string) {
  const config = await getBotConfig();
  if (!config) return null;

  const res = await fetch(`https://discord.com/api/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${config.token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; name: string; icon: string | null; approximate_member_count?: number };
}

export async function getGuildChannels(guildId: string) {
  const config = await getBotConfig();
  if (!config) return [];

  const res = await fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${config.token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const channels: { id: string; name: string; type: number }[] = await res.json();
  return channels.filter((c) => c.type === 0).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getGuildRoles(guildId: string) {
  const config = await getBotConfig();
  if (!config) return [];

  const res = await fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${config.token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const roles: { id: string; name: string; managed: boolean }[] = await res.json();
  return roles.filter((r) => !r.managed && r.name !== "@everyone");
}

export async function checkBotConnection(): Promise<{ connected: boolean; tag?: string }> {
  const config = await getBotConfig();
  if (!config) return { connected: false };

  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bot ${config.token}` },
    cache: "no-store",
  });
  if (!res.ok) return { connected: false };
  const me = (await res.json()) as { username: string; discriminator: string };
  return { connected: true, tag: me.discriminator && me.discriminator !== "0" ? `${me.username}#${me.discriminator}` : me.username };
}

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

export interface UserGuild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
}

export async function getUserGuilds(accessToken: string): Promise<UserGuild[]> {
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export function canManageGuild(permissions: string): boolean {
  const bits = BigInt(permissions);
  return (bits & MANAGE_GUILD) !== 0n || (bits & ADMINISTRATOR) !== 0n;
}

export async function canUserManageGuild(accessToken: string, guildId: string): Promise<boolean> {
  const guilds = await getUserGuilds(accessToken);
  const guild = guilds.find((g) => g.id === guildId);
  return guild ? canManageGuild(guild.permissions) : false;
}
