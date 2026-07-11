const INVITE_REGEX = /(discord\.gg\/|discord(?:app)?\.com\/invite\/)[a-zA-Z0-9-]+/i;

const PROTOCOL_LINK_REGEX = /https?:\/\/\S+/gi;

// Common TLDs used by spam/scam links. Bots almost never type "http(s)://" since
// Twitch/Discord auto-linkify bare domains, so matching only the protocol form
// (the old behavior) let every one of them through.
const LINK_TLDS = [
  "com", "net", "org", "gg", "tv", "io", "co", "me", "link", "xyz", "info", "biz",
  "live", "stream", "gift", "club", "site", "online", "shop", "store", "app", "dev",
  "gl", "ru", "cc", "top", "win", "bid", "click", "download", "monster", "fun", "icu",
  "cf", "ga", "ml", "tk", "ws", "us", "uk", "de", "fr", "es", "it", "nl", "be", "ch",
  "se", "no", "dk", "pl", "cz", "jp", "cn", "kr", "in", "br", "mx", "ca", "au", "nz",
  "za", "to", "sh", "vip", "pro", "life", "world", "cam", "fyi", "page", "cloud",
  "ly", "gd", "st", "im", "id", "so", "tc",
];
const BARE_DOMAIN_SOURCE = `\\b(?:www\\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.(?:${LINK_TLDS.join("|")})\\b(?:\\/\\S*)?`;
const BARE_DOMAIN_REGEX = new RegExp(BARE_DOMAIN_SOURCE, "gi");

// Undoes common "dot" obfuscation (spaced dots, "(dot)", "[.]", " dot ") before matching,
// so e.g. "twitch . tv" or "discord (dot) gg" are still caught.
function normalizeLinkObfuscation(content: string): string {
  return content
    .replace(/\s*[([]\s*dot\s*[)\]]\s*/gi, ".")
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s*[([]\s*\.\s*[)\]]\s*/g, ".")
    .replace(/([a-z0-9])\s+\.\s+([a-z]{2,})/gi, "$1.$2");
}

function extractLinks(content: string): string[] {
  const normalized = normalizeLinkObfuscation(content);
  const protocolLinks = normalized.match(PROTOCOL_LINK_REGEX) ?? [];
  const bareLinks = normalized.match(BARE_DOMAIN_REGEX) ?? [];
  return [...protocolLinks, ...bareLinks];
}

export function matchesInvite(content: string): boolean {
  return INVITE_REGEX.test(normalizeLinkObfuscation(content));
}

export function matchesLink(content: string): boolean {
  return extractLinks(content).length > 0;
}

export function matchesUnwhitelistedLink(content: string, whitelist: string[]): boolean {
  const links = extractLinks(content);
  if (links.length === 0) return false;
  if (whitelist.length === 0) return true;
  return links.some((url) => {
    try {
      const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const host = new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
      return !whitelist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    } catch {
      return true;
    }
  });
}

export function hasExcessiveCaps(content: string): boolean {
  const letters = content.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 12) return false;
  const upper = letters.replace(/[^A-Z]/g, "");
  return upper.length / letters.length > 0.7;
}

export function hasExcessiveSymbols(content: string): boolean {
  const stripped = content.replace(/\s/g, "");
  if (stripped.length < 8) return false;
  const symbols = stripped.replace(/[a-zA-Z0-9À-ÿ]/g, "");
  return symbols.length / stripped.length > 0.5;
}

export function hasWordRepetition(content: string): boolean {
  const words = content.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 4) return false;
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  return maxCount >= 4 && maxCount / words.length > 0.5;
}

interface SpamEntry {
  content: string;
  count: number;
  firstAt: number;
}

const spamTracker = new Map<string, SpamEntry>();
const SPAM_WINDOW_MS = 8_000;
const SPAM_REPEAT_THRESHOLD = 3;

export function isSpam(userId: string, channelId: string, content: string): boolean {
  const key = `${userId}:${channelId}`;
  const normalized = content.trim().toLowerCase();
  const now = Date.now();
  const entry = spamTracker.get(key);

  if (!entry || now - entry.firstAt > SPAM_WINDOW_MS || entry.content !== normalized) {
    spamTracker.set(key, { content: normalized, count: 1, firstAt: now });
    return false;
  }

  entry.count++;
  if (entry.count >= SPAM_REPEAT_THRESHOLD) {
    spamTracker.delete(key);
    return true;
  }
  return false;
}
