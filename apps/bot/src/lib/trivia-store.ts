import type { TriviaQuestion } from "./trivia-questions.js";

export interface TriviaRound {
  question: TriviaQuestion;
  guildId: string;
  answered: boolean;
}

export const triviaRounds = new Map<string, TriviaRound>();
