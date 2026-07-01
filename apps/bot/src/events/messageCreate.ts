import { Events, type Message, type TextChannel } from "discord.js";
import { prisma } from "@tina/database";
import { grantMessageXp } from "../lib/xp.js";
import { findAutoResponseMatch } from "../lib/auto-response.js";
import { bombeRounds } from "../lib/bombe-store.js";

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  if (message.author.bot || !message.guild) return;

  const channel = message.channel as TextChannel;

  const bombeRound = bombeRounds.get(message.channelId);
  if (bombeRound?.active) {
    const word = message.content.trim();
    const isSingleWord = word.length > 0 && !/\s/.test(word);
    if (isSingleWord && word.toLowerCase().includes(bombeRound.syllable.toLowerCase())) {
      bombeRounds.delete(message.channelId);
      await prisma.guild.upsert({ where: { id: message.guild.id }, create: { id: message.guild.id }, update: {} });
      await prisma.gameStat.upsert({
        where: { guildId_userId_game: { guildId: message.guild.id, userId: message.author.id, game: "BOMBE" } },
        create: { guildId: message.guild.id, userId: message.author.id, game: "BOMBE", plays: 1, wins: 1 },
        update: { plays: { increment: 1 }, wins: { increment: 1 } },
      });
      await channel.send(`💥 ${message.author} a trouve **${word}** et desamorce la bombe !`).catch(() => null);
    }
  }

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

  if (message.content.startsWith(prefix)) {
    const commandName = message.content.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
    if (commandName) {
      const customCommand = await prisma.customCommand.findUnique({
        where: { guildId_name: { guildId: message.guild.id, name: commandName } },
      });
      if (customCommand) {
        await channel.send(customCommand.response).catch(() => null);
        return;
      }
    }
  }

  const autoResponse = await findAutoResponseMatch(message.guild.id, message.content);
  if (autoResponse) {
    await channel.send(autoResponse.response).catch(() => null);
  }
}
