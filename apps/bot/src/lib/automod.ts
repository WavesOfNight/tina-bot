const LOW_WORDS = ["negro", "sale race", "sale juif", "sale arabe", "nazi de merde"];

const MEDIUM_WORDS = [
  ...LOW_WORDS,
  "pute",
  "putain",
  "connard",
  "connasse",
  "enculé",
  "encule",
  "batard",
  "bâtard",
  "salope",
  "fdp",
  "ntm",
  "nique ta mere",
  "nique ta mère",
];

const HIGH_WORDS = [
  ...MEDIUM_WORDS,
  "merde",
  "chier",
  "con",
  "conne",
  "cul",
  "pd",
  "pédé",
  "pede",
  "pipi",
  "caca",
  "boobs",
  "sexe",
];

const LEVEL_WORDS: Record<string, string[]> = {
  LOW: LOW_WORDS,
  MEDIUM: MEDIUM_WORDS,
  HIGH: HIGH_WORDS,
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function findAutoModMatch(level: string, content: string): string | null {
  const words = LEVEL_WORDS[level];
  if (!words) return null;

  const normalized = normalize(content);
  for (const word of words) {
    const normalizedWord = normalize(word);
    const pattern = new RegExp(`\\b${normalizedWord.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (pattern.test(normalized)) return word;
  }
  return null;
}

export const AUTOMOD_LEVELS = ["OFF", "LOW", "MEDIUM", "HIGH"] as const;
