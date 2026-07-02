import type { ButtonHandler } from "../types.js";
import { blackjackRounds } from "../lib/blackjack-store.js";
import { handValue } from "../lib/blackjack.js";
import {
  bumpBlackjackStat,
  buildBlackjackComponents,
  buildBlackjackEmbed,
  judgeOutcome,
  playDealer,
} from "../commands/games/blackjack.js";

const handler: ButtonHandler = {
  prefix: "blackjack",
  async execute(interaction, parts) {
    const [action, roundId] = parts;
    const round = blackjackRounds.get(roundId);

    if (!round?.active) {
      await interaction.reply({ content: "Cette partie est deja terminee.", ephemeral: true });
      return;
    }
    if (interaction.user.id !== round.playerId) {
      await interaction.reply({ content: "Ce n'est pas ta partie !", ephemeral: true });
      return;
    }

    if (action === "hit") {
      round.playerHand.push(round.deck.pop()!);

      if (handValue(round.playerHand) > 21) {
        round.active = false;
        blackjackRounds.delete(roundId);
        await bumpBlackjackStat(round.guildId, round.playerId, "losses");
        await interaction.update({
          embeds: [buildBlackjackEmbed(round, true, "Tu as depasse 21, tu perds.")],
          components: buildBlackjackComponents(roundId, true),
        });
        return;
      }

      await interaction.update({
        embeds: [buildBlackjackEmbed(round, false, "Tire une carte ou reste sur ta main.")],
        components: buildBlackjackComponents(roundId),
      });
      return;
    }

    // action === "stand"
    round.active = false;
    blackjackRounds.delete(roundId);
    playDealer(round);
    const { outcome, reason } = judgeOutcome(round);
    await bumpBlackjackStat(round.guildId, round.playerId, outcome === "push" ? "draws" : outcome === "win" ? "wins" : "losses");
    await interaction.update({
      embeds: [buildBlackjackEmbed(round, true, reason)],
      components: buildBlackjackComponents(roundId, true),
    });
  },
};

export default handler;
