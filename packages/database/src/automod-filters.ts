const INVITE_REGEX = /(discord\.gg\/|discord(?:app)?\.com\/invite\/)[a-zA-Z0-9-]+/i;
const LINK_REGEX = /https?:\/\/\S+/i;

export function matchesInvite(content: string): boolean {
  return INVITE_REGEX.test(content);
}

export function matchesLink(content: string): boolean {
  return LINK_REGEX.test(content);
}

export function matchesUnwhitelistedLink(content: string, whitelist: string[]): boolean {
  if (!matchesLink(content)) return false;
  if (whitelist.length === 0) return true;
  const urls = content.match(/https?:\/\/\S+/gi) ?? [];
  return urls.some((url) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
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
