import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";
import { blackjackRounds, type BlackjackRound } from "../../lib/blackjack-store.js";
import { createDeck, formatHand, handValue, isBlackjack } from "../../lib/blackjack.js";

export async function bumpBlackjackStat(guildId: string, userId: string, field: "wins" | "losses" | "draws") {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "BLACKJACK" } },
    create: { guildId, userId, game: "BLACKJACK", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
}

export function buildBlackjackComponents(roundId: string, disabled = false) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`blackjack:hit:${roundId}`).setLabel("Tirer").setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`blackjack:stand:${roundId}`).setLabel("Rester").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
  return [row];
}

export function buildBlackjackEmbed(round: BlackjackRound, finished: boolean, footer: string) {
  const dealerDisplay = finished ? formatHand(round.dealerHand) : `${round.dealerHand[0]} 🂠`;
  const dealerValue = finished ? ` (${handValue(round.dealerHand)})` : "";

  return new EmbedBuilder()
    .setColor(0x7f77dd)
    .setTitle("🃏 Blackjack")
    .addFields(
      { name: "Ta main", value: `${formatHand(round.playerHand)} (${handValue(round.playerHand)})` },
      { name: "Main du croupier", value: `${dealerDisplay}${dealerValue}` },
    )
    .setFooter({ text: footer });
}

export function playDealer(round: BlackjackRound) {
  while (handValue(round.dealerHand) < 17) {
    round.dealerHand.push(round.deck.pop()!);
  }
}

export function judgeOutcome(round: BlackjackRound): { outcome: "win" | "lose" | "push"; reason: string } {
  const playerValue = handValue(round.playerHand);
  const dealerValue = handValue(round.dealerHand);

  if (playerValue > 21) return { outcome: "lose", reason: "Tu as depasse 21, tu perds." };
  if (dealerValue > 21) return { outcome: "win", reason: "Le croupier depasse 21, tu gagnes !" };
  if (playerValue > dealerValue) return { outcome: "win", reason: "Tu gagnes !" };
  if (playerValue < dealerValue) return { outcome: "lose", reason: "Le croupier gagne." };
  return { outcome: "push", reason: "Egalite !" };
}

const command: Command = {
  data: new SlashCommandBuilder().setName("blackjack").setDescription("Joue au blackjack contre le croupier"),
  async execute(interaction) {
    if (!interaction.guildId) return;

    const deck = createDeck();
    const round: BlackjackRound = {
      playerId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageId: "pending",
      deck,
      playerHand: [deck.pop()!, deck.pop()!],
      dealerHand: [deck.pop()!, deck.pop()!],
      active: true,
    };

    const playerBlackjack = isBlackjack(round.playerHand);
    const dealerBlackjack = isBlackjack(round.dealerHand);

    if (playerBlackjack || dealerBlackjack) {
      const outcome = playerBlackjack && dealerBlackjack ? "push" : playerBlackjack ? "win" : "lose";
      const reason =
        outcome === "push"
          ? "Egalite, vous avez tous les deux un blackjack !"
          : outcome === "win"
            ? "Blackjack ! Tu gagnes !"
            : "Le croupier a un blackjack, tu perds.";

      await bumpBlackjackStat(round.guildId, round.playerId, outcome === "push" ? "draws" : outcome === "win" ? "wins" : "losses");
      await interaction.reply({ embeds: [buildBlackjackEmbed(round, true, reason)] });
      return;
    }

    const reply = await interaction.reply({
      embeds: [buildBlackjackEmbed(round, false, "Tire une carte ou reste sur ta main.")],
      components: buildBlackjackComponents("pending"),
      fetchReply: true,
    });

    round.messageId = reply.id;
    blackjackRounds.set(reply.id, round);
    await interaction.editReply({ components: buildBlackjackComponents(reply.id) });
  },
};

export default command;
