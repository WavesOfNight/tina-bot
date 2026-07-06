import {
  EmbedBuilder,
  Events,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type TextChannel,
  type User,
} from "discord.js";
import { prisma } from "@tina/database";

export const name = Events.MessageReactionAdd;
export const once = false;

export async function execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
  if (user.bot) return;

  const message = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
  if (!message?.guild || message.author?.bot) return;

  const guildRecord = await prisma.guild.findUnique({ where: { id: message.guild.id } });
  if (!guildRecord?.starboardChannelId) return;
  if ((reaction.emoji.name ?? "") !== guildRecord.starboardEmoji) return;

  const fullReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
  const count = fullReaction?.count ?? 0;
  if (count < guildRecord.starboardThreshold) return;

  const starboardChannel = message.guild.channels.cache.get(guildRecord.starboardChannelId) as TextChannel | undefined;
  if (!starboardChannel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0xffd76e)
    .setAuthor({ name: message.author?.tag ?? "Inconnu", iconURL: message.author?.displayAvatarURL() })
    .setDescription(message.content || "*(pas de texte)*")
    .addFields({ name: "Salon", value: `<#${message.channelId}>` })
    .setTimestamp(message.createdAt);

  const imageUrl = message.attachments.find((a) => a.contentType?.startsWith("image/"))?.url;
  if (imageUrl) embed.setImage(imageUrl);

  const content = `${guildRecord.starboardEmoji} **${count}** | <#${message.channelId}>`;
  const existing = await prisma.starboardPost.findUnique({ where: { originalMessageId: message.id } });

  if (existing) {
    const starboardMessage = await starboardChannel.messages.fetch(existing.starboardMessageId).catch(() => null);
    if (starboardMessage) {
      await starboardMessage.edit({ content, embeds: [embed] }).catch(() => null);
      await prisma.starboardPost.update({ where: { id: existing.id }, data: { starCount: count } });
    }
    return;
  }

  const posted = await starboardChannel.send({ content, embeds: [embed] }).catch(() => null);
  if (!posted) return;

  await prisma.starboardPost.create({
    data: {
      guildId: message.guild.id,
      originalMessageId: message.id,
      originalChannelId: message.channelId,
      starboardMessageId: posted.id,
      starCount: count,
    },
  });
}
