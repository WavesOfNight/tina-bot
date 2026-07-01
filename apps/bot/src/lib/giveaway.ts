import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { prisma } from "@tina/database";

export function buildGiveawayComponents(giveawayId: number, ended = false) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway:join:${giveawayId}`)
        .setLabel("Participer")
        .setEmoji("🎉")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(ended),
    ),
  ];
}

export function buildGiveawayEmbed(params: {
  prize: string;
  winnerCount: number;
  hostId: string;
  endsAt: Date;
  entryCount: number;
  ended?: boolean;
  winners?: string[];
}) {
  const embed = new EmbedBuilder()
    .setColor(params.ended ? 0x888780 : 0xd4537e)
    .setTitle(params.ended ? `Giveaway termine : ${params.prize}` : `🎉 Giveaway : ${params.prize}`)
    .addFields(
      { name: "Organise par", value: `<@${params.hostId}>`, inline: true },
      { name: "Gagnants", value: `${params.winnerCount}`, inline: true },
      { name: "Participants", value: `${params.entryCount}`, inline: true },
    );

  if (params.ended) {
    embed.addFields({
      name: "Resultat",
      value: params.winners?.length ? params.winners.map((id) => `<@${id}>`).join(", ") : "Aucun participant",
    });
  } else {
    embed.addFields({ name: "Fin", value: `<t:${Math.floor(params.endsAt.getTime() / 1000)}:R>` });
  }

  return embed;
}

export async function endGiveaway(client: Client, giveawayId: number) {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId }, include: { entries: true } });
  if (!giveaway || giveaway.ended) return;

  const fetchedChannel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!fetchedChannel || !fetchedChannel.isTextBased()) return;
  const channel = fetchedChannel as TextChannel;

  const entrants = giveaway.entries.map((e) => e.userId);
  const winners: string[] = [];
  const pool = [...entrants];
  const winnerCount = Math.min(giveaway.winnerCount, pool.length);
  for (let i = 0; i < winnerCount; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }

  await prisma.giveaway.update({ where: { id: giveaway.id }, data: { ended: true } });

  const embed = buildGiveawayEmbed({
    prize: giveaway.prize,
    winnerCount: giveaway.winnerCount,
    hostId: giveaway.hostId,
    endsAt: giveaway.endsAt,
    entryCount: entrants.length,
    ended: true,
    winners,
  });

  if (giveaway.messageId) {
    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (message) {
      await message.edit({ embeds: [embed], components: buildGiveawayComponents(giveaway.id, true) }).catch(() => null);
    }
  }

  if (winners.length > 0) {
    await channel
      .send(`Felicitations ${winners.map((id) => `<@${id}>`).join(", ")} ! Tu remportes **${giveaway.prize}** !`)
      .catch(() => null);
  } else {
    await channel.send(`Personne n'a participe au giveaway **${giveaway.prize}**.`).catch(() => null);
  }
}

export async function checkExpiredGiveaways(client: Client) {
  const expired = await prisma.giveaway.findMany({ where: { ended: false, endsAt: { lte: new Date() } } });
  for (const giveaway of expired) {
    await endGiveaway(client, giveaway.id);
  }
}

export async function postPendingGiveaways(client: Client) {
  const pending = await prisma.giveaway.findMany({ where: { ended: false, messageId: null } });
  for (const giveaway of pending) {
    const fetchedChannel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!fetchedChannel || !fetchedChannel.isTextBased()) continue;
    const channel = fetchedChannel as TextChannel;

    const embed = buildGiveawayEmbed({
      prize: giveaway.prize,
      winnerCount: giveaway.winnerCount,
      hostId: giveaway.hostId,
      endsAt: giveaway.endsAt,
      entryCount: 0,
    });
    const message = await channel.send({ embeds: [embed], components: buildGiveawayComponents(giveaway.id) }).catch(() => null);
    if (message) {
      await prisma.giveaway.update({ where: { id: giveaway.id }, data: { messageId: message.id } });
    }
  }
}
