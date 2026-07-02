export type ChifumiChoice = "pierre" | "feuille" | "ciseaux";

export interface ChifumiDuel {
  players: [string, string];
  choices: Partial<Record<string, ChifumiChoice>>;
  guildId: string;
  channelId: string;
  messageId: string;
  matchId?: string;
}

export const chifumiDuels = new Map<string, ChifumiDuel>();

const BEATS: Record<ChifumiChoice, ChifumiChoice> = {
  pierre: "ciseaux",
  feuille: "pierre",
  ciseaux: "feuille",
};

const EMOJI: Record<ChifumiChoice, string> = { pierre: "🪨", feuille: "📄", ciseaux: "✂️" };

export function resolveChifumi(a: ChifumiChoice, b: ChifumiChoice): "a" | "b" | "draw" {
  if (a === b) return "draw";
  return BEATS[a] === b ? "a" : "b";
}

export function chifumiEmoji(choice: ChifumiChoice): string {
  return EMOJI[choice];
}
