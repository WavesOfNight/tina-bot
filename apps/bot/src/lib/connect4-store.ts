export const COLS = 7;
export const ROWS = 6;

export interface Connect4Game {
  board: (null | 0 | 1)[][];
  players: [string, string];
  turn: 0 | 1;
  guildId: string;
  matchId?: string;
}

export const connect4Games = new Map<string, Connect4Game>();

export function createBoard(): (null | 0 | 1)[][] {
  return Array.from({ length: ROWS }, () => Array<null | 0 | 1>(COLS).fill(null));
}

export function dropPiece(board: (null | 0 | 1)[][], col: number, player: 0 | 1): number | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === null) {
      board[row][col] = player;
      return row;
    }
  }
  return null;
}

export function checkConnect4Winner(board: (null | 0 | 1)[][], row: number, col: number): boolean {
  const player = board[row][col];
  if (player === null) return false;

  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
        count++;
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (count >= 4) return true;
  }
  return false;
}

export function isBoardFull(board: (null | 0 | 1)[][]): boolean {
  return board[0].every((cell) => cell !== null);
}

export function renderBoard(board: (null | 0 | 1)[][]): string {
  const emojis = { null: "⚫", 0: "🔴", 1: "🟡" } as const;
  const rows = board.map((row) => row.map((cell) => emojis[cell === null ? "null" : cell]).join(""));
  const columnNumbers = "1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣";
  return [...rows, columnNumbers].join("\n");
}
