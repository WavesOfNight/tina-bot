// Severe hate speech / slurs - blocked even at the lowest filter level.
const LOW_FR = [
  "sale race",
  "sale juif",
  "sale juive",
  "sale arabe",
  "sale noir",
  "sale noire",
  "nazi de merde",
  "negro",
  "negresse",
  "negrillon",
  "bougnoule",
  "bounty",
  "tete de bougnoule",
];
const LOW_EN = ["nigger", "nigga", "faggot", "faggy", "retard", "retarded", "kike", "chink", "spic", "tranny", "beaner"];
const LOW_DE = ["neger", "negerin", "kanake", "kanacke", "schwuchtel"];
const LOW_ES = ["negrata", "negrata de mierda", "sudaca", "maricon de mierda"];
const LOW_IT = ["negraccio", "negraccia", "frocio di merda", "terrone"];

const LOW_WORDS = [...LOW_FR, ...LOW_EN, ...LOW_DE, ...LOW_ES, ...LOW_IT];

// Common swear words / insults - blocked from the medium level up.
const MEDIUM_FR = ["pute", "putain", "connard", "connasse", "encule", "enculé", "batard", "bâtard", "salope", "fdp", "ntm", "nique ta mere", "nique ta mère"];
const MEDIUM_EN = ["fuck", "fucking", "fucker", "bitch", "bastard", "asshole", "cunt", "motherfucker", "dick", "prick", "twat"];
const MEDIUM_DE = ["scheisse", "scheiße", "hurensohn", "wichser", "arschloch", "fotze", "schlampe"];
const MEDIUM_ES = ["puta", "puto", "cabron", "cabrón", "gilipollas", "hijo de puta", "mierda de mierda", "coño"];
const MEDIUM_IT = ["puttana", "stronzo", "stronza", "coglione", "vaffanculo", "figlio di puttana", "troia"];

const MEDIUM_WORDS = [...LOW_WORDS, ...MEDIUM_FR, ...MEDIUM_EN, ...MEDIUM_DE, ...MEDIUM_ES, ...MEDIUM_IT];

// Mild language, still filtered at the strictest level (family-friendly servers).
const HIGH_FR = ["merde", "chier", "con", "conne", "cul", "pd", "pédé", "pede", "pipi", "caca", "boobs", "sexe"];
const HIGH_EN = ["damn", "crap", "hell", "piss", "boobs", "sex", "poop", "pee"];
const HIGH_DE = ["scheisse leicht", "verdammt", "mist", "kacke", "pisse"];
const HIGH_ES = ["mierda", "joder", "caca", "pis", "pedo", "culo"];
const HIGH_IT = ["cazzo", "merda", "cacca", "pipi", "culo"];

const HIGH_WORDS = [...MEDIUM_WORDS, ...HIGH_FR, ...HIGH_EN, ...HIGH_DE, ...HIGH_ES, ...HIGH_IT];

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
    // Trailing "s?" tolerates simple plurals (e.g. "negro" also catches "negros") without
    // needing a separate list entry for each. Feminine forms are added as distinct words
    // instead (e.g. "negresse", "conne") since they aren't a simple suffix and a blind "+e"
    // would false-positive on innocent words like "cone".
    const pattern = new RegExp(`\\b${normalizedWord.replace(/\s+/g, "\\s+")}s?\\b`, "i");
    if (pattern.test(normalized)) return word;
  }
  return null;
}

export const AUTOMOD_LEVELS = ["OFF", "LOW", "MEDIUM", "HIGH"] as const;
