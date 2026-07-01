export interface BombeRound {
  syllable: string;
  guildId: string;
  active: boolean;
}

export const bombeRounds = new Map<string, BombeRound>();

export const BOMBE_SYLLABLES = [
  "TER", "ON", "AN", "RA", "TI", "LO", "MA", "RI", "SO", "CHA",
  "PA", "TRA", "BLE", "VER", "TION", "OU", "IN", "EAU", "AGE", "MENT",
];

export function pickSyllable(): string {
  return BOMBE_SYLLABLES[Math.floor(Math.random() * BOMBE_SYLLABLES.length)];
}
