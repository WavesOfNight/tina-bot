const INVITE_REGEX = /(discord\.gg\/|discord(?:app)?\.com\/invite\/)[a-zA-Z0-9-]+/i;
const LINK_REGEX = /https?:\/\/\S+/i;

export function matchesInvite(content: string): boolean {
  return INVITE_REGEX.test(content);
}

export function matchesLink(content: string): boolean {
  return LINK_REGEX.test(content);
}

export function hasExcessiveCaps(content: string): boolean {
  const letters = content.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 12) return false;
  const upper = letters.replace(/[^A-Z]/g, "");
  return upper.length / letters.length > 0.7;
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
