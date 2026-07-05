export const MAX_LEVEL = 50;
export const XP_COOLDOWN_MS = 60_000;
export const XP_MIN = 15;
export const XP_MAX = 25;

export function xpToReachLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

export function levelFromXp(totalXp: number): number {
  let level = 0;
  let cumulative = 0;
  while (level < MAX_LEVEL) {
    cumulative += xpToReachLevel(level);
    if (totalXp < cumulative) break;
    level++;
  }
  return level;
}

export function xpProgress(totalXp: number, level: number): { current: number; needed: number } {
  let cumulative = 0;
  for (let i = 0; i < level; i++) cumulative += xpToReachLevel(i);
  return { current: totalXp - cumulative, needed: xpToReachLevel(level) };
}

export function rollGainedXp(): number {
  return Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
}
