import type { CheckerBoard, CheckerColor } from "./dames.js";
import { createInitialCheckerBoard } from "./dames.js";

export interface DamesGame {
  board: CheckerBoard;
  turn: CheckerColor;
  players: Record<CheckerColor, string>;
  guildId: string;
  channelId: string;
  active: boolean;
}

export const damesGames = new Map<string, DamesGame>();

export function createDamesGame(channelId: string, guildId: string, whiteId: string, blackId: string): DamesGame {
  const game: DamesGame = {
    board: createInitialCheckerBoard(),
    turn: "w",
    players: { w: whiteId, b: blackId },
    guildId,
    channelId,
    active: true,
  };
  damesGames.set(channelId, game);
  return game;
}
