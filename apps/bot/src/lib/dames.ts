export type CheckerColor = "w" | "b";
export interface CheckerPiece {
  color: CheckerColor;
  king: boolean;
}
export interface Square {
  file: number;
  rank: number;
}
export type CheckerBoard = (CheckerPiece | null)[][];

export interface CheckerMove {
  to: Square;
  captured?: Square;
}

function inBounds(sq: Square): boolean {
  return sq.file >= 0 && sq.file <= 7 && sq.rank >= 0 && sq.rank <= 7;
}

export function createInitialCheckerBoard(): CheckerBoard {
  const board: CheckerBoard = Array.from({ length: 8 }, () => Array<CheckerPiece | null>(8).fill(null));
  for (let rank = 0; rank < 3; rank++) {
    for (let file = 0; file < 8; file++) {
      if ((file + rank) % 2 === 0) board[rank][file] = { color: "w", king: false };
    }
  }
  for (let rank = 5; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      if ((file + rank) % 2 === 0) board[rank][file] = { color: "b", king: false };
    }
  }
  return board;
}

export function parseSquare(input: string): Square | null {
  const match = /^([a-h])([1-8])$/i.exec(input.trim());
  if (!match) return null;
  return { file: match[1].toLowerCase().charCodeAt(0) - 97, rank: Number(match[2]) - 1 };
}

function directionsFor(piece: CheckerPiece): number[] {
  if (piece.king) return [1, -1];
  return piece.color === "w" ? [1] : [-1];
}

export function legalMovesForSquare(board: CheckerBoard, from: Square): CheckerMove[] {
  const piece = board[from.rank][from.file];
  if (!piece) return [];

  const moves: CheckerMove[] = [];
  for (const dr of directionsFor(piece)) {
    for (const df of [-1, 1]) {
      const step = { file: from.file + df, rank: from.rank + dr };
      if (!inBounds(step)) continue;
      const occupant = board[step.rank][step.file];
      if (!occupant) {
        moves.push({ to: step });
      } else if (occupant.color !== piece.color) {
        const jump = { file: from.file + df * 2, rank: from.rank + dr * 2 };
        if (inBounds(jump) && !board[jump.rank][jump.file]) {
          moves.push({ to: jump, captured: step });
        }
      }
    }
  }
  return moves;
}

export function applyCheckerMove(board: CheckerBoard, from: Square, move: CheckerMove): CheckerBoard {
  const next = board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
  const piece = next[from.rank][from.file];
  if (!piece) return next;

  next[from.rank][from.file] = null;
  if (move.captured) next[move.captured.rank][move.captured.file] = null;

  const shouldPromote = (piece.color === "w" && move.to.rank === 7) || (piece.color === "b" && move.to.rank === 0);
  next[move.to.rank][move.to.file] = { color: piece.color, king: piece.king || shouldPromote };

  return next;
}

export function countPieces(board: CheckerBoard, color: CheckerColor): number {
  let count = 0;
  for (const row of board) {
    for (const piece of row) {
      if (piece?.color === color) count += 1;
    }
  }
  return count;
}

export function hasAnyLegalMove(board: CheckerBoard, color: CheckerColor): boolean {
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece?.color === color && legalMovesForSquare(board, { file, rank }).length > 0) return true;
    }
  }
  return false;
}

export function renderCheckerBoard(board: CheckerBoard): string {
  const lines: string[] = ["  a b c d e f g h"];
  for (let rank = 7; rank >= 0; rank--) {
    const row: string[] = [];
    for (let file = 0; file < 8; file++) {
      if ((file + rank) % 2 !== 0) {
        row.push(" ");
        continue;
      }
      const piece = board[rank][file];
      if (!piece) {
        row.push(".");
        continue;
      }
      const ch = piece.color === "w" ? "w" : "b";
      row.push(piece.king ? ch.toUpperCase() : ch);
    }
    lines.push(`${rank + 1} ${row.join(" ")}`);
  }
  return lines.join("\n");
}
