// Severe hate speech / slurs - blocked even at the lowest filter level.
const LOW_FR = [
  "sale race",
  "sale juif",
  "sale juive",
  "sale arabe",
  "sale noir",
  "sale noire",
  "sale gitan",
  "sale rom",
  "sale tzigane",
  "nazi de merde",
  "negro",
  "negresse",
  "negrillon",
  "bougnoule",
  "bounty",
  "tete de bougnoule",
  "raton",
  "feuj",
  "youpin",
  "bicot",
];
const LOW_EN = [
  "nigger",
  "nigga",
  "faggot",
  "faggy",
  "retard",
  "retarded",
  "kike",
  "chink",
  "spic",
  "tranny",
  "beaner",
  "wetback",
  "gook",
  "raghead",
  "towelhead",
  "paki",
  "coon",
  "darkie",
  "honkey",
  "jigaboo",
  "nig nog",
  "wop",
  "dyke",
  "bulldyke",
];
const LOW_DE = [
  "neger",
  "negerin",
  "kanake",
  "kanacke",
  "schwuchtel",
  "zigeuner",
  "judensau",
  "scheiss auslander",
];
const LOW_ES = [
  "negrata",
  "negrata de mierda",
  "sudaca",
  "maricon de mierda",
  "gitano de mierda",
  "panchito",
  "indio de mierda",
  "bollera",
];
const LOW_IT = [
  "negraccio",
  "negraccia",
  "frocio di merda",
  "terrone",
  "marocchino di merda",
  "zingaro di merda",
  "ricchione",
  "busone",
  "bucaiolo",
  "culattone",
  "culattina",
];

const LOW_WORDS = [...LOW_FR, ...LOW_EN, ...LOW_DE, ...LOW_ES, ...LOW_IT];

// Common swear words / insults - blocked from the medium level up.
const MEDIUM_FR = [
  "pute",
  "putain",
  "putain de merde",
  "connard",
  "connasse",
  "encule",
  "enculé",
  "enculeur",
  "batard",
  "bâtard",
  "salope",
  "salaud",
  "fdp",
  "ntm",
  "nique ta mere",
  "nique ta mère",
  "nique ta race",
  "fils de pute",
  "ta gueule",
  "ferme ta gueule",
  "sac a merde",
  "sac a foutre",
  "baiser",
  "bander",
  "bite",
  "bitte",
  "branler",
  "branlette",
  "branleur",
  "branleuse",
  "chatte",
  "chiasse",
  "chiottes",
  "clito",
  "clitoris",
  "couilles",
  "cramouille",
  "deconner",
  "déconner",
  "emmerder",
  "emmerdeur",
  "emmerdeuse",
  "etron",
  "étron",
  "foutre",
  "gerber",
  "gouine",
  "grogniasse",
  "jouir",
  "palucher",
  "pisser",
  "pouffiasse",
  "ramoner",
];
const MEDIUM_EN = [
  "fuck",
  "fucking",
  "fucker",
  "fuckin",
  "fucktard",
  "fuckface",
  "motherfucking",
  "bitch",
  "bitches",
  "bastard",
  "asshole",
  "asswipe",
  "asshat",
  "cunt",
  "motherfucker",
  "dick",
  "dickhead",
  "prick",
  "twat",
  "bollocks",
  "bullshit",
  "dumbass",
  "jackass",
  "shithead",
  "shitface",
  "douchebag",
  "douche",
  "dipshit",
  "cocksucker",
  "wanker",
  "tosser",
  "skank",
  "thot",
  "whore",
  "slut",
];
const MEDIUM_DE = [
  "scheisse",
  "scheiße",
  "hurensohn",
  "wichser",
  "wichsen",
  "wichse",
  "arschloch",
  "fotze",
  "schlampe",
  "arschficker",
  "arschlecker",
  "bratze",
  "bumsen",
  "dodel",
  "fick",
  "ficken",
  "flittchen",
  "hackfresse",
  "kackbratze",
  "kacken",
  "kackwurst",
  "lummel",
  "morgenlatte",
  "muschi",
  "onanieren",
  "pimmel",
  "pimpern",
  "poppen",
  "schabracke",
  "schwanzlutscher",
  "tittchen",
  "titten",
  "vogeln",
];
const MEDIUM_ES = [
  "puta",
  "puto",
  "cabron",
  "cabrón",
  "gilipollas",
  "gilipichis",
  "jilipollas",
  "kapullo",
  "hijo de puta",
  "hijaputa",
  "hijoputa",
  "mierda de mierda",
  "coño",
  "concha",
  "concha de tu madre",
  "chupada",
  "chupapollas",
  "follador",
  "follar",
  "hacer una paja",
  "marica",
  "maricon",
  "mariconazo",
  "mamada",
  "pendejo",
  "pinche",
  "ramera",
  "soplagaitas",
  "soplapollas",
  "verga",
  "vete a la mierda",
];
const MEDIUM_IT = [
  "puttana",
  "stronzo",
  "stronza",
  "stronzata",
  "coglione",
  "vaffanculo",
  "figlio di puttana",
  "figlio di buona donna",
  "troia",
  "bagascia",
  "bagassa",
  "baldracca",
  "battona",
  "bocchino",
  "bocchinara",
  "cagare",
  "cagata",
  "cazzata",
  "cazzone",
  "chiavare",
  "chiavata",
  "ciucciami il cazzo",
  "fica",
  "figa",
  "fottere",
  "fottersi",
  "fregna",
  "leccaculo",
  "merdata",
  "merdoso",
  "mignotta",
  "minchia",
  "minchione",
  "pippa",
  "pippone",
  "pirla",
  "pisciare",
  "piscio",
  "pompa",
  "pompino",
  "porca madonna",
  "porca miseria",
  "porca puttana",
  "potta",
  "sborra",
  "sborrata",
  "sborrone",
  "succhiami",
  "succhione",
  "testa di cazzo",
  "tette",
  "trombare",
  "zinne",
  "zoccola",
];

const MEDIUM_WORDS = [...LOW_WORDS, ...MEDIUM_FR, ...MEDIUM_EN, ...MEDIUM_DE, ...MEDIUM_ES, ...MEDIUM_IT];

// Mild language, still filtered at the strictest level (family-friendly servers).
const HIGH_FR = [
  "merde",
  "chier",
  "con",
  "conne",
  "cul",
  "pd",
  "pédé",
  "pede",
  "tafiole",
  "tarlouze",
  "pipi",
  "caca",
  "boobs",
  "sexe",
  "nichons",
];
const HIGH_EN = [
  "damn",
  "crap",
  "hell",
  "piss",
  "boobs",
  "boob",
  "sex",
  "poop",
  "pee",
  "ass",
  "butt",
  "horny",
  "nude",
  "nudity",
  "orgasm",
  "porn",
  "porno",
  "pornography",
  "topless",
  "xxx",
];
const HIGH_DE = ["scheisse leicht", "verdammt", "mist", "kacke", "pisse", "arsch", "nackt", "porno", "penis"];
const HIGH_ES = ["mierda", "joder", "caca", "pis", "pedo", "culo", "asno", "idiota", "imbecil", "imbécil"];
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

// Common leetspeak / lookalike substitutions used to dodge a plain word match
// (e.g. "p3ute", "c@nnard"). Only applied to letters with an unambiguous digit/symbol
// stand-in - "u"/"v" or "l"/"1" style swaps are deliberately left out since they collide
// with too many innocent words.
const LEET_MAP: Record<string, string> = {
  a: "a4@",
  e: "e3",
  i: "i1!",
  o: "o0",
  s: "s5$",
  t: "t7",
};

// Tolerated "noise" between letters of the same word (e.g. "p.u.t.e", "p u t e", "p_u_t_e").
// Capped at 2 characters so the pattern can't stretch across an entire unrelated sentence.
const INTRA_WORD_GAP = "[^a-z0-9]{0,2}";
// Tolerated gap between the words of a multi-word phrase (e.g. "sale   race").
const INTER_WORD_GAP = "[^a-z0-9]{1,4}";

// Below this length, evasion-tolerant matching is skipped entirely: short words (con, cul,
// ass, sex...) are already borderline-broad matches, and letting separators/leetspeak slip
// between just 2-3 letters would make them match all kinds of unrelated text.
const MIN_LENGTH_FOR_EVASION_TOLERANCE = 4;

function escapeRegexChar(ch: string): string {
  return /[.*+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}

function charClass(ch: string): string {
  const variants = LEET_MAP[ch];
  return variants ? `[${variants}]` : escapeRegexChar(ch);
}

function buildPattern(normalizedWord: string): RegExp {
  const letterCount = normalizedWord.replace(/\s/g, "").length;

  if (letterCount < MIN_LENGTH_FOR_EVASION_TOLERANCE) {
    const body = normalizedWord
      .split("")
      .map((ch) => (ch === " " ? "\\s+" : escapeRegexChar(ch)))
      .join("");
    return new RegExp(`(?<![a-z0-9])${body}s?(?![a-z0-9])`, "i");
  }

  const chars = normalizedWord.split("");
  const parts: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === " ") {
      parts.push(INTER_WORD_GAP);
      continue;
    }
    parts.push(charClass(ch));
    const next = chars[i + 1];
    if (next !== undefined && next !== " ") {
      parts.push(INTRA_WORD_GAP);
    }
  }
  return new RegExp(`(?<![a-z0-9])${parts.join("")}s?(?![a-z0-9])`, "i");
}

interface CompiledWord {
  original: string;
  pattern: RegExp;
}

function compileWords(words: string[]): CompiledWord[] {
  return words.map((word) => ({ original: word, pattern: buildPattern(normalize(word)) }));
}

// Compiled once at module load - the list is now large enough that rebuilding every
// pattern on every single chat message would be wasteful.
const LEVEL_PATTERNS: Record<string, CompiledWord[]> = {
  LOW: compileWords(LOW_WORDS),
  MEDIUM: compileWords(MEDIUM_WORDS),
  HIGH: compileWords(HIGH_WORDS),
};

export function findAutoModMatch(level: string, content: string): string | null {
  const patterns = LEVEL_PATTERNS[level];
  if (!patterns) return null;

  const normalized = normalize(content);
  for (const { original, pattern } of patterns) {
    if (pattern.test(normalized)) return original;
  }
  return null;
}

export const AUTOMOD_LEVELS = ["OFF", "LOW", "MEDIUM", "HIGH"] as const;
