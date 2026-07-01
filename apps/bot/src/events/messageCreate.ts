import { Events, type Message, type TextChannel } from "discord.js";
import { prisma } from "@tina/database";
import { grantMessageXp } from "../lib/xp.js";

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  if (message.author.bot || !message.guild) return;

  const channel = message.channel as TextChannel;

  const result = await grantMessageXp(message.guild.id, message.author.id);
  if (result?.leveledUp) {
    await channel
      .send(`GG ${message.author} ! Tu passes au niveau **${result.newLevel}** !`)
      .catch(() => null);

    const reward = await prisma.levelReward.findUnique({
      where: { guildId_level: { guildId: message.guild.id, level: result.newLevel } },
    });
    if (reward) {
      const role = await message.guild.roles.fetch(reward.roleId).catch(() => null);
      if (role && message.member) {
        await message.member.roles.add(role).catch(() => null);
      }
    }
  }

  const guildData = await prisma.guild.findUnique({ where: { id: message.guild.id } });
  const prefix = guildData?.prefix ?? "!";
  if (!message.content.startsWith(prefix)) return;

  const commandName = message.content.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
  if (!commandName) return;

  const customCommand = await prisma.customCommand.findUnique({
    where: { guildId_name: { guildId: message.guild.id, name: commandName } },
  });
  if (customCommand) {
    await channel.send(customCommand.response).catch(() => null);
  }
}
