export interface Match {
  matchId: string;
  game: "MORPION" | "CONNECT4" | "CHIFUMI";
  players: [string, string];
  scores: [number, number];
  roundsToWin: number;
  round: number;
  guildId: string;
  channelId: string;
}

export const matches = new Map<string, Match>();

export function createMatch(params: {
  matchId: string;
  game: Match["game"];
  players: [string, string];
  bestOf: number;
  guildId: string;
  channelId: string;
}): Match | null {
  if (params.bestOf <= 1) return null;
  const match: Match = {
    matchId: params.matchId,
    game: params.game,
    players: params.players,
    scores: [0, 0],
    roundsToWin: Math.ceil(params.bestOf / 2),
    round: 1,
    guildId: params.guildId,
    channelId: params.channelId,
  };
  matches.set(params.matchId, match);
  return match;
}

export function recordRoundResult(matchId: string, winnerIndex: 0 | 1 | null): { match: Match; finished: boolean; matchWinnerIndex: 0 | 1 | null } | null {
  const match = matches.get(matchId);
  if (!match) return null;

  if (winnerIndex !== null) {
    match.scores[winnerIndex]++;
  }
  match.round++;

  const winnerReached = match.scores[0] >= match.roundsToWin ? 0 : match.scores[1] >= match.roundsToWin ? 1 : null;
  if (winnerReached !== null) {
    matches.delete(matchId);
    return { match, finished: true, matchWinnerIndex: winnerReached };
  }

  return { match, finished: false, matchWinnerIndex: null };
}

export function matchScoreLine(match: Match): string {
  return `Score de la manche : <@${match.players[0]}> ${match.scores[0]} - ${match.scores[1]} <@${match.players[1]}>`;
}
