export interface BlackjackRound {
  playerId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  deck: string[];
  playerHand: string[];
  dealerHand: string[];
  active: boolean;
}

export const blackjackRounds = new Map<string, BlackjackRound>();
