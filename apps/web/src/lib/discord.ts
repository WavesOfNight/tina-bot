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

export async function getGuildChannels(guildId: string, type = 0) {
  const config = await getBotConfig();
  if (!config) return [];

  const res = await fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${config.token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const channels: { id: string; name: string; type: number }[] = await res.json();
  return channels.filter((c) => c.type === type).sort((a, b) => a.name.localeCompare(b.name));
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

export async function createPermanentInvite(channelId: string): Promise<{ code: string } | null> {
  const config = await getBotConfig();
  if (!config) return null;

  const res = await fetch(`https://discord.com/api/channels/${channelId}/invites`, {
    method: "POST",
    headers: { Authorization: `Bot ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ max_age: 0, max_uses: 0, unique: false }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const invite = (await res.json()) as { code: string };
  return { code: invite.code };
}

export async function postTicketPanel(channelId: string): Promise<boolean> {
  const config = await getBotConfig();
  if (!config) return false;

  const res = await fetch(`https://discord.com/api/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "🎫 Support",
          description: "Besoin d'aide ou tu veux signaler quelque chose ? Clique sur le bouton ci-dessous pour ouvrir un ticket prive.",
          color: 0x5865f2,
        },
      ],
      components: [
        {
          type: 1,
          components: [{ type: 2, style: 3, label: "Ouvrir un ticket", custom_id: "ticket:open", emoji: { name: "🎫" } }],
        },
      ],
    }),
    cache: "no-store",
  }).catch(() => null);

  return Boolean(res?.ok);
}

export async function getGuildMemberDisplayNames(guildId: string, userIds: string[]): Promise<Map<string, string>> {
  const config = await getBotConfig();
  const map = new Map<string, string>();
  if (!config) return map;

  const uniqueIds = [...new Set(userIds)];
  await Promise.all(
    uniqueIds.map(async (userId) => {
      const res = await fetch(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
        headers: { Authorization: `Bot ${config.token}` },
        cache: "no-store",
      }).catch(() => null);
      if (!res || !res.ok) return;
      const member = (await res.json()) as { nick?: string | null; user?: { username: string; global_name?: string | null } };
      const name = member.nick ?? member.user?.global_name ?? member.user?.username;
      if (name) map.set(userId, name);
    }),
  );
  return map;
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
