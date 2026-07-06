import { Events, type Message, type TextChannel } from "discord.js";
import { prisma, findAutoModMatch, hasExcessiveCaps, isSpam, matchesInvite, matchesLink } from "@tina/database";
import { grantMessageXp } from "../lib/xp.js";
import { findAutoResponseMatch } from "../lib/auto-response.js";
import { bombeRounds } from "../lib/bombe-store.js";
import { applyWarnEscalation, logCase } from "../lib/moderation.js";
import { isWordComplete, penduRounds } from "../lib/pendu-store.js";
import { buildPenduEmbed } from "../commands/games/pendu.js";
import { runActionChain } from "../lib/action-chain.js";

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  if (message.author.bot || !message.guild) return;

  const channel = message.channel as TextChannel;
  const guildData = await prisma.guild.findUnique({ where: { id: message.guild.id } });

  const violation = detectAutoModViolation(message, guildData);
  if (violation && message.deletable) {
    await message.delete().catch(() => null);
    await logCase({
      guild: message.guild,
      userId: message.author.id,
      moderatorId: message.client.user.id,
      type: "AUTOMOD",
      reason: violation,
    });
    await applyWarnEscalation(message.guild, message.author.id);
    const notice = await channel
      .send(`⚠️ ${message.author}, ton message a ete supprime par la moderation automatique (${violation}).`)
      .catch(() => null);
    setTimeout(() => notice?.delete().catch(() => null), 6_000);
    return;
  }

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

  const penduRound = penduRounds.get(message.channelId);
  if (penduRound?.active) {
    await handlePenduGuess(message, channel);
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

  const prefix = guildData?.prefix ?? "!";

  if (message.content.startsWith(prefix)) {
    const rest = message.content.slice(prefix.length).trim();
    const parts = rest.split(/\s+/);
    const commandName = parts[0]?.toLowerCase();
    const args = parts.slice(1);
    if (commandName) {
      const customCommand = await prisma.customCommand.findUnique({
        where: { guildId_name: { guildId: message.guild.id, name: commandName } },
        include: { actions: true },
      });
      if (customCommand) {
        const now = Date.now();
        const lastUsed = customCommand.lastUsedAt?.getTime() ?? 0;
        if (customCommand.cooldownSeconds > 0 && now - lastUsed < customCommand.cooldownSeconds * 1000) return;

        if (customCommand.actions.length > 0) {
          if (message.member) {
            await runActionChain(customCommand.actions, { message, member: message.member, guild: message.guild, args }, (text) =>
              isBlockedByFilter(text, guildData),
            );
          }
        } else if (!isBlockedByFilter(customCommand.response, guildData)) {
          await channel.send(customCommand.response).catch(() => null);
        }
        await prisma.customCommand.update({ where: { id: customCommand.id }, data: { lastUsedAt: new Date() } });
        return;
      }
    }
  }

  const autoResponse = await findAutoResponseMatch(message.guild.id, message.content);
  if (autoResponse && !isBlockedByFilter(autoResponse.response, guildData)) {
    await channel.send(autoResponse.response).catch(() => null);
  }
}

async function handlePenduGuess(message: Message, channel: TextChannel) {
  const round = penduRounds.get(message.channelId);
  if (!round?.active || !message.guild) return;

  const normalized = message.content
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  const isSingleLetterGuess = /^[A-Z]$/.test(normalized) && !round.guessedLetters.has(normalized);
  const isFullWordGuess = normalized.length > 1 && /^[A-Z]+$/.test(normalized);
  if (!isSingleLetterGuess && !(isFullWordGuess && normalized === round.word)) return;

  if (isFullWordGuess) {
    round.word.split("").forEach((letter) => round.guessedLetters.add(letter));
  } else {
    round.guessedLetters.add(normalized);
    if (!round.word.includes(normalized)) round.wrongGuesses += 1;
  }

  const roundMessage = await channel.messages.fetch(round.messageId).catch(() => null);

  if (isWordComplete(round)) {
    round.active = false;
    penduRounds.delete(message.channelId);
    await prisma.guild.upsert({ where: { id: message.guild.id }, create: { id: message.guild.id }, update: {} });
    await prisma.gameStat.upsert({
      where: { guildId_userId_game: { guildId: message.guild.id, userId: message.author.id, game: "PENDU" } },
      create: { guildId: message.guild.id, userId: message.author.id, game: "PENDU", plays: 1, wins: 1 },
      update: { plays: { increment: 1 }, wins: { increment: 1 } },
    });
    await roundMessage
      ?.edit({ embeds: [buildPenduEmbed(round, `${message.author.username} a trouve le mot : ${round.word} !`)] })
      .catch(() => null);
    return;
  }

  if (round.wrongGuesses >= round.maxWrong) {
    round.active = false;
    penduRounds.delete(message.channelId);
    await roundMessage
      ?.edit({ embeds: [buildPenduEmbed(round, `Perdu ! Le mot etait : ${round.word}`)] })
      .catch(() => null);
    return;
  }

  await roundMessage?.edit({ embeds: [buildPenduEmbed(round, "Tape une lettre ou le mot complet dans le chat !")] }).catch(() => null);
}

function isBlockedByFilter(
  text: string,
  guildData: { autoModLevel: string } | null,
): boolean {
  if (!guildData || guildData.autoModLevel === "OFF") return false;
  return findAutoModMatch(guildData.autoModLevel, text) !== null;
}

function detectAutoModViolation(
  message: Message,
  guildData: {
    autoModLevel: string;
    filterInvites: boolean;
    filterLinks: boolean;
    filterCaps: boolean;
    filterSpam: boolean;
  } | null,
): string | null {
  if (!guildData) return null;
  if (message.member?.permissions.has("ManageMessages")) return null;

  if (guildData.autoModLevel !== "OFF") {
    const matchedWord = findAutoModMatch(guildData.autoModLevel, message.content);
    if (matchedWord) return `mot filtre : "${matchedWord}"`;
  }

  if (guildData.filterLinks && matchesLink(message.content)) return "lien externe non autorise";
  if (guildData.filterInvites && matchesInvite(message.content)) return "invitation Discord non autorisee";
  if (guildData.filterCaps && hasExcessiveCaps(message.content)) return "majuscules excessives";
  if (guildData.filterSpam && isSpam(message.author.id, message.channelId, message.content)) return "spam de messages";

  return null;
}
