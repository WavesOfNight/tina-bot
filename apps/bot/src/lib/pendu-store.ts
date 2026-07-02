export interface PenduRound {
  word: string;
  category: string;
  guessedLetters: Set<string>;
  wrongGuesses: number;
  maxWrong: number;
  guildId: string;
  messageId: string;
  active: boolean;
}

export const penduRounds = new Map<string, PenduRound>();

const HANGMAN_STAGES = [
  "```\n  +---+\n      |\n      |\n      |\n     ===```",
  "```\n  +---+\n  O   |\n      |\n      |\n     ===```",
  "```\n  +---+\n  O   |\n  |   |\n      |\n     ===```",
  "```\n  +---+\n  O   |\n /|   |\n      |\n     ===```",
  "```\n  +---+\n  O   |\n /|\\  |\n      |\n     ===```",
  "```\n  +---+\n  O   |\n /|\\  |\n /    |\n     ===```",
  "```\n  +---+\n  O   |\n /|\\  |\n / \\  |\n     ===```",
];

export function hangmanStage(wrongGuesses: number): string {
  const index = Math.min(wrongGuesses, HANGMAN_STAGES.length - 1);
  return HANGMAN_STAGES[index];
}

export function maskedWord(round: PenduRound): string {
  return round.word
    .split("")
    .map((letter) => (round.guessedLetters.has(letter) ? letter : "_"))
    .join(" ");
}

export function isWordComplete(round: PenduRound): boolean {
  return round.word.split("").every((letter) => round.guessedLetters.has(letter));
}
