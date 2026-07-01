import { prisma } from "@tina/database";
import type { ButtonHandler } from "../types.js";
import { buildGiveawayComponents, buildGiveawayEmbed } from "../lib/giveaway.js";

async function refreshGiveawayMessage(interaction: Parameters<ButtonHandler["execute"]>[0], giveawayId: number) {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId }, include: { entries: true } });
  if (!giveaway || !giveaway.messageId || !interaction.message) return;

  const embed = buildGiveawayEmbed({
    prize: giveaway.prize,
    winnerCount: giveaway.winnerCount,
    hostId: giveaway.hostId,
    endsAt: giveaway.endsAt,
    entryCount: giveaway.entries.length,
  });
  await interaction.message.edit({ embeds: [embed], components: buildGiveawayComponents(giveaway.id) }).catch(() => null);
}

const handler: ButtonHandler = {
  prefix: "giveaway",
  async execute(interaction, parts) {
    const [action, giveawayIdStr] = parts;
    if (action !== "join") return;

    const giveawayId = Number(giveawayIdStr);
    const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });

    if (!giveaway || giveaway.ended) {
      await interaction.reply({ content: "Ce giveaway est termine ou n'existe plus.", ephemeral: true });
      return;
    }

    const existing = await prisma.giveawayEntry.findUnique({
      where: { giveawayId_userId: { giveawayId, userId: interaction.user.id } },
    });

    if (existing) {
      await prisma.giveawayEntry.delete({ where: { id: existing.id } });
      await interaction.reply({ content: "Tu as retire ta participation.", ephemeral: true });
      await refreshGiveawayMessage(interaction, giveawayId);
      return;
    }

    await prisma.giveawayEntry.create({ data: { giveawayId, userId: interaction.user.id } });
    await interaction.reply({ content: `Participation enregistree pour **${giveaway.prize}** !`, ephemeral: true });
    await refreshGiveawayMessage(interaction, giveawayId);
  },
};

export default handler;
