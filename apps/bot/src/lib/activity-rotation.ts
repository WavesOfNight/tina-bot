import { ActivityType, type Client } from "discord.js";
import { prisma } from "@tina/database";

const ACTIVITY_TYPE_MAP: Record<string, ActivityType> = {
  PLAYING: ActivityType.Playing,
  WATCHING: ActivityType.Watching,
  LISTENING: ActivityType.Listening,
  COMPETING: ActivityType.Competing,
};

const DEFAULT_TEXT = "sur le panel web de Tina";
const DEFAULT_DURATION_MS = 30_000;

let currentIndex = 0;
let timer: NodeJS.Timeout | null = null;

function resolveActivityText(text: string, client: Client<true>): string {
  let resolved = text;

  if (resolved.includes("{randomMember}")) {
    const guilds = [...client.guilds.cache.values()];
    const guild = guilds[Math.floor(Math.random() * guilds.length)];
    const members = guild ? [...guild.members.cache.filter((m) => !m.user.bot).values()] : [];
    const member = members[Math.floor(Math.random() * members.length)];
    resolved = resolved.replaceAll("{randomMember}", member ? member.user.username : "quelqu'un");
  }

  if (resolved.includes("{memberCount}")) {
    const total = client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);
    resolved = resolved.replaceAll("{memberCount}", total.toString());
  }

  if (resolved.includes("{serverCount}")) {
    resolved = resolved.replaceAll("{serverCount}", client.guilds.cache.size.toString());
  }

  return resolved;
}

export function stopActivityRotation() {
  if (timer) clearTimeout(timer);
  timer = null;
}

export async function startActivityRotation(client: Client<true>) {
  stopActivityRotation();
  currentIndex = 0;

  async function tick() {
    if (!client.user) return;

    const activities = await prisma.botActivity.findMany({ where: { enabled: true }, orderBy: { order: "asc" } }).catch(() => []);

    if (activities.length === 0) {
      client.user.setPresence({ activities: [{ name: DEFAULT_TEXT, type: ActivityType.Watching }], status: "online" });
      timer = setTimeout(tick, DEFAULT_DURATION_MS);
      return;
    }

    if (currentIndex >= activities.length) currentIndex = 0;
    const activity = activities[currentIndex];
    const text = resolveActivityText(activity.text, client);
    const type = ACTIVITY_TYPE_MAP[activity.type] ?? ActivityType.Watching;

    client.user.setPresence({ activities: [{ name: text, type }], status: "online" });
    currentIndex = (currentIndex + 1) % activities.length;

    const durationMs = Math.max(5, activity.durationSeconds) * 1000;
    timer = setTimeout(tick, durationMs);
  }

  await tick();
}
