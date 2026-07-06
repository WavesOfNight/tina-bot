import { EmbedBuilder, Events, type Message, type PartialMessage } from "discord.js";
import { prisma } from "@tina/database";
import { sendLogEmbed } from "../lib/logging.js";

export const name = Events.MessageUpdate;
export const once = false;

export async function execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const guildRecord = await prisma.guild.findUnique({ where: { id: newMessage.guild.id } });
  if (!guildRecord?.logMessageEdit) return;

  const embed = new EmbedBuilder()
    .setColor(0xd8a530)
    .setTitle("Message modifie")
    .addFields(
      { name: "Auteur", value: newMessage.author ? `<@${newMessage.author.id}>` : "Inconnu", inline: true },
      { name: "Salon", value: `<#${newMessage.channelId}>`, inline: true },
      { name: "Avant", value: oldMessage.content ? oldMessage.content.slice(0, 1000) : "*(inconnu)*" },
      { name: "Apres", value: newMessage.content ? newMessage.content.slice(0, 1000) : "*(aucun contenu)*" },
    )
    .setTimestamp();

  await sendLogEmbed(newMessage.guild, embed);
}
