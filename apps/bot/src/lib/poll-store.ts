export interface Poll {
  question: string;
  options: string[];
  votes: Map<string, number>;
}

export const polls = new Map<string, Poll>();

export function pollResultsText(poll: Poll): string {
  const counts = poll.options.map((_, index) => [...poll.votes.values()].filter((v) => v === index).length);
  const total = counts.reduce((sum, c) => sum + c, 0);

  return poll.options
    .map((option, index) => {
      const count = counts[index];
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      const barLength = Math.round(percent / 10);
      const bar = "█".repeat(barLength) + "░".repeat(10 - barLength);
      return `**${option}**\n${bar} ${percent}% (${count} vote${count > 1 ? "s" : ""})`;
    })
    .join("\n\n");
}
