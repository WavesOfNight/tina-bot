import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { prisma } from "@tina/database";

export async function buildReactionRoleMessagePayload(reactionRoleMessageId: number) {
  const record = await prisma.reactionRoleMessage.findUnique({
    where: { id: reactionRoleMessageId },
    include: { buttons: true },
  });
  if (!record) return null;

  const embed = new EmbedBuilder()
    .setColor(0x1d9e75)
    .setTitle(record.title)
    .setDescription(
      record.buttons.length > 0
        ? "Clique sur un bouton pour obtenir ou retirer le role correspondant."
        : "Aucun role configure pour le moment.",
    );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let row = new ActionRowBuilder<ButtonBuilder>();
  record.buttons.forEach((button, index) => {
    if (index > 0 && index % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder<ButtonBuilder>();
    }
    const buttonBuilder = new ButtonBuilder()
      .setCustomId(`rr:${record.id}:${button.roleId}`)
      .setLabel(button.label)
      .setStyle(ButtonStyle.Secondary);
    if (button.emoji) buttonBuilder.setEmoji(button.emoji);
    row.addComponents(buttonBuilder);
  });
  if (record.buttons.length > 0) rows.push(row);

  return { embeds: [embed], components: rows };
}

export async function syncReactionRoleMessages(client: Client) {
  const dirtyRecords = await prisma.reactionRoleMessage.findMany({ where: { dirty: true } });

  for (const record of dirtyRecords) {
    const channel = (await client.channels.fetch(record.channelId).catch(() => null)) as TextChannel | null;
    if (!channel?.isTextBased()) continue;

    const payload = await buildReactionRoleMessagePayload(record.id);
    if (!payload) continue;

    if (record.messageId) {
      const message = await channel.messages.fetch(record.messageId).catch(() => null);
      if (message) {
        await message.edit(payload).catch(() => null);
      } else {
        const sent = await channel.send(payload).catch(() => null);
        if (sent) await prisma.reactionRoleMessage.update({ where: { id: record.id }, data: { messageId: sent.id } });
      }
    } else {
      const sent = await channel.send(payload).catch(() => null);
      if (sent) await prisma.reactionRoleMessage.update({ where: { id: record.id }, data: { messageId: sent.id } });
    }

    await prisma.reactionRoleMessage.update({ where: { id: record.id }, data: { dirty: false } });
  }
}
