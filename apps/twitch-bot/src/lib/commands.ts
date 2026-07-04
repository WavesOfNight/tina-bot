import { prisma, incrementTwitchDailyStat } from "@tina/database";
import type tmi from "tmi.js";

export async function handleTwitchCommand(
  client: tmi.Client,
  channel: string,
  prefix: string,
  message: string,
  username: string,
): Promise<boolean> {
  if (!message.startsWith(prefix)) return false;

  const name = message.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
  if (!name) return false;

  const command = await prisma.twitchCommand.findUnique({ where: { name } });
  if (!command) return false;

  const now = Date.now();
  const lastUsed = command.lastUsedAt?.getTime() ?? 0;
  if (now - lastUsed < command.cooldownSeconds * 1000) return true;

  const response = command.response.replaceAll("{user}", username).replaceAll("{channel}", channel.replace(/^#/, ""));
  await client.say(channel, response).catch(() => null);
  await prisma.twitchCommand.update({ where: { id: command.id }, data: { uses: { increment: 1 }, lastUsedAt: new Date() } });
  await incrementTwitchDailyStat("commands").catch(() => null);

  return true;
}
