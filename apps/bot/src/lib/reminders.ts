import type { Client, TextChannel } from "discord.js";
import { prisma } from "@tina/database";

export async function checkDueReminders(client: Client) {
  const due = await prisma.reminder.findMany({ where: { sent: false, remindAt: { lte: new Date() } } });

  for (const reminder of due) {
    await prisma.reminder.update({ where: { id: reminder.id }, data: { sent: true } });

    const channel = (await client.channels.fetch(reminder.channelId).catch(() => null)) as TextChannel | null;
    if (!channel?.isTextBased()) continue;

    await channel
      .send(`⏰ <@${reminder.userId}>, rappel : ${reminder.message}`)
      .catch(() => null);
  }
}
