import { EmbedBuilder, Events, type Message, type PartialMessage } from "discord.js";
import { prisma } from "@tina/database";
import { sendLogEmbed } from "../lib/logging.js";

export const name = Events.MessageDelete;
export const once = false;

export async function execute(message: Message | PartialMessage) {
  if (!message.guild || message.author?.bot) return;

  const guildRecord = await prisma.guild.findUnique({ where: { id: message.guild.id } });
  if (!guildRecord?.logMessageDelete) return;

  const embed = new EmbedBuilder()
    .setColor(0xd85a30)
    .setTitle("Message supprime")
    .addFields(
      { name: "Auteur", value: message.author ? `<@${message.author.id}>` : "Inconnu", inline: true },
      { name: "Salon", value: `<#${message.channelId}>`, inline: true },
      { name: "Contenu", value: message.content ? message.content.slice(0, 1000) : "*(aucun contenu texte)*" },
    )
    .setTimestamp();

  await sendLogEmbed(message.guild, embed);
}
