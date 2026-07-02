import type { Board, PieceColor } from "./chess.js";
import { createInitialBoard } from "./chess.js";

export interface ChessGame {
  board: Board;
  turn: PieceColor;
  players: Record<PieceColor, string>;
  guildId: string;
  channelId: string;
  active: boolean;
  moveCount: number;
}

export const chessGames = new Map<string, ChessGame>();

export function createChessGame(channelId: string, guildId: string, whiteId: string, blackId: string): ChessGame {
  const game: ChessGame = {
    board: createInitialBoard(),
    turn: "w",
    players: { w: whiteId, b: blackId },
    guildId,
    channelId,
    active: true,
    moveCount: 0,
  };
  chessGames.set(channelId, game);
  return game;
}
