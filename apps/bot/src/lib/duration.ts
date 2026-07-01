const UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDuration(input: string): number | null {
  const match = input.trim().toLowerCase().match(/^(\d+)\s*([smhd])$/);
  if (!match) return null;
  const [, amount, unit] = match;
  return Number(amount) * UNITS[unit];
}
