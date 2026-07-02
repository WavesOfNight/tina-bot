export type PieceColor = "w" | "b";
export type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";
export interface Piece {
  color: PieceColor;
  type: PieceType;
}
export interface Square {
  file: number;
  rank: number;
}
export type Board = (Piece | null)[][];

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
  const backRank: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let f = 0; f < 8; f++) {
    board[0][f] = { color: "w", type: backRank[f] };
    board[1][f] = { color: "w", type: "P" };
    board[6][f] = { color: "b", type: "P" };
    board[7][f] = { color: "b", type: backRank[f] };
  }
  return board;
}

export function parseSquare(input: string): Square | null {
  const match = /^([a-h])([1-8])$/i.exec(input.trim());
  if (!match) return null;
  return { file: match[1].toLowerCase().charCodeAt(0) - 97, rank: Number(match[2]) - 1 };
}

export function squareLabel(sq: Square): string {
  return `${String.fromCharCode(97 + sq.file)}${sq.rank + 1}`;
}

function inBounds(sq: Square): boolean {
  return sq.file >= 0 && sq.file <= 7 && sq.rank >= 0 && sq.rank <= 7;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

const KNIGHT_OFFSETS = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING_OFFSETS = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const ROOK_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRECTIONS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function slidingMoves(board: Board, from: Square, color: PieceColor, directions: number[][]): Square[] {
  const moves: Square[] = [];
  for (const [df, dr] of directions) {
    let current = { file: from.file + df, rank: from.rank + dr };
    while (inBounds(current)) {
      const occupant = board[current.rank][current.file];
      if (!occupant) {
        moves.push({ ...current });
      } else {
        if (occupant.color !== color) moves.push({ ...current });
        break;
      }
      current = { file: current.file + df, rank: current.rank + dr };
    }
  }
  return moves;
}

function pseudoLegalMoves(board: Board, from: Square): Square[] {
  const piece = board[from.rank][from.file];
  if (!piece) return [];

  if (piece.type === "N") {
    return KNIGHT_OFFSETS.map(([df, dr]) => ({ file: from.file + df, rank: from.rank + dr })).filter(
      (sq) => inBounds(sq) && board[sq.rank][sq.file]?.color !== piece.color,
    );
  }

  if (piece.type === "K") {
    return KING_OFFSETS.map(([df, dr]) => ({ file: from.file + df, rank: from.rank + dr })).filter(
      (sq) => inBounds(sq) && board[sq.rank][sq.file]?.color !== piece.color,
    );
  }

  if (piece.type === "R") return slidingMoves(board, from, piece.color, ROOK_DIRECTIONS);
  if (piece.type === "B") return slidingMoves(board, from, piece.color, BISHOP_DIRECTIONS);
  if (piece.type === "Q") return slidingMoves(board, from, piece.color, [...ROOK_DIRECTIONS, ...BISHOP_DIRECTIONS]);

  // Pawn
  const direction = piece.color === "w" ? 1 : -1;
  const startRank = piece.color === "w" ? 1 : 6;
  const moves: Square[] = [];

  const oneStep = { file: from.file, rank: from.rank + direction };
  if (inBounds(oneStep) && !board[oneStep.rank][oneStep.file]) {
    moves.push(oneStep);
    const twoStep = { file: from.file, rank: from.rank + direction * 2 };
    if (from.rank === startRank && !board[twoStep.rank][twoStep.file]) moves.push(twoStep);
  }

  for (const df of [-1, 1]) {
    const capture = { file: from.file + df, rank: from.rank + direction };
    if (inBounds(capture) && board[capture.rank][capture.file] && board[capture.rank][capture.file]!.color !== piece.color) {
      moves.push(capture);
    }
  }

  return moves;
}

function findKing(board: Board, color: PieceColor): Square | null {
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (piece?.type === "K" && piece.color === color) return { file: f, rank: r };
    }
  }
  return null;
}

export function isSquareAttacked(board: Board, target: Square, byColor: PieceColor): boolean {
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece || piece.color !== byColor) continue;
      const moves = pseudoLegalMoves(board, { file: f, rank: r });
      if (moves.some((m) => m.file === target.file && m.rank === target.rank)) return true;
    }
  }
  return false;
}

export function isInCheck(board: Board, color: PieceColor): boolean {
  const king = findKing(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king, color === "w" ? "b" : "w");
}

export function applyMove(board: Board, from: Square, to: Square): Board {
  const next = cloneBoard(board);
  const piece = next[from.rank][from.file];
  if (!piece) return next;

  next[from.rank][from.file] = null;
  if (piece.type === "P" && (to.rank === 0 || to.rank === 7)) {
    next[to.rank][to.file] = { color: piece.color, type: "Q" };
  } else {
    next[to.rank][to.file] = piece;
  }
  return next;
}

export function legalMoves(board: Board, from: Square): Square[] {
  const piece = board[from.rank][from.file];
  if (!piece) return [];

  return pseudoLegalMoves(board, from).filter((to) => {
    const simulated = applyMove(board, from, to);
    return !isInCheck(simulated, piece.color);
  });
}

export function allLegalMoves(board: Board, color: PieceColor): { from: Square; to: Square }[] {
  const moves: { from: Square; to: Square }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece || piece.color !== color) continue;
      const from = { file: f, rank: r };
      for (const to of legalMoves(board, from)) moves.push({ from, to });
    }
  }
  return moves;
}

const WHITE_SYMBOLS: Record<PieceType, string> = { P: "P", N: "N", B: "B", R: "R", Q: "Q", K: "K" };
const BLACK_SYMBOLS: Record<PieceType, string> = { P: "p", N: "n", B: "b", R: "r", Q: "q", K: "k" };

export function renderBoard(board: Board): string {
  const lines: string[] = ["  a b c d e f g h"];
  for (let rank = 7; rank >= 0; rank--) {
    const row = board[rank]
      .map((piece) => {
        if (!piece) return ".";
        return piece.color === "w" ? WHITE_SYMBOLS[piece.type] : BLACK_SYMBOLS[piece.type];
      })
      .join(" ");
    lines.push(`${rank + 1} ${row}`);
  }
  return lines.join("\n");
}
