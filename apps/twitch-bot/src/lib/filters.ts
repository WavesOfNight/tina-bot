import { hasExcessiveCaps, hasExcessiveSymbols, hasWordRepetition, isSpam, matchesUnwhitelistedLink } from "@tina/database";
import type { ResolvedTwitchBotConfig } from "@tina/database";
import type tmi from "tmi.js";

export interface FilterMatch {
  reason: string;
  punish: boolean;
}

export function isSharedChatMessage(tags: tmi.ChatUserstate): boolean {
  const sourceRoomId = tags["source-room-id"];
  const roomId = tags["room-id"];
  return Boolean(sourceRoomId && roomId && sourceRoomId !== roomId);
}

function countEmotes(tags: tmi.ChatUserstate): number {
  const emotes = tags.emotes;
  if (!emotes) return 0;
  return Object.values(emotes).reduce((total, ranges) => total + (ranges?.length ?? 0), 0);
}

export function findGranularFilterMatch(
  config: ResolvedTwitchBotConfig,
  tags: tmi.ChatUserstate,
  channel: string,
  content: string,
): FilterMatch | null {
  if (config.filterSharedChatEnabled && isSharedChatMessage(tags)) {
    return { reason: "message provenant d'un chat partage", punish: false };
  }
  if (config.filterLinksEnabled && matchesUnwhitelistedLink(content, config.linkWhitelist)) {
    return { reason: "lien non autorise", punish: true };
  }
  if (config.filterCapsEnabled && hasExcessiveCaps(content)) {
    return { reason: "majuscules excessives", punish: true };
  }
  if (config.filterEmotesEnabled && countEmotes(tags) > config.maxEmotes) {
    return { reason: "emotes excessifs", punish: true };
  }
  if (config.filterSymbolsEnabled && hasExcessiveSymbols(content)) {
    return { reason: "symboles excessifs", punish: true };
  }
  if (config.filterRepetitionEnabled) {
    const userId = tags["user-id"];
    if (hasWordRepetition(content) || (userId && isSpam(userId, channel, content))) {
      return { reason: "repetition excessive", punish: true };
    }
  }
  return null;
}
