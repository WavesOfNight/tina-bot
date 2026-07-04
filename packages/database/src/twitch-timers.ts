import { prisma } from "./client.js";
import type { TwitchTimer } from "@prisma/client";

export async function getTwitchTimers(): Promise<TwitchTimer[]> {
  return prisma.twitchTimer.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getEnabledTwitchTimers(): Promise<TwitchTimer[]> {
  return prisma.twitchTimer.findMany({ where: { enabled: true } });
}

export async function createTwitchTimer(data: {
  name: string;
  message: string;
  intervalMinutes: number;
  minMessages: number;
}): Promise<void> {
  await prisma.twitchTimer.create({ data });
}

export async function updateTwitchTimer(
  id: number,
  data: { name: string; message: string; intervalMinutes: number; minMessages: number; enabled: boolean },
): Promise<void> {
  await prisma.twitchTimer.update({ where: { id }, data });
}

export async function deleteTwitchTimer(id: number): Promise<void> {
  await prisma.twitchTimer.delete({ where: { id } });
}

export async function markTwitchTimerSent(id: number): Promise<void> {
  await prisma.twitchTimer.update({ where: { id }, data: { lastSentAt: new Date() } });
}
