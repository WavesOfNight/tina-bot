import { EmbedBuilder, Events, type GuildMember, type PartialGuildMember } from "discord.js";
import { prisma } from "@tina/database";
import { sendLogEmbed } from "../lib/logging.js";

export const name = Events.GuildMemberRemove;
export const once = false;

export async function execute(member: GuildMember | PartialGuildMember) {
  const guildRecord = await prisma.guild.findUnique({ where: { id: member.guild.id } });
  if (!guildRecord?.logMemberLeave) return;

  const embed = new EmbedBuilder()
    .setColor(0x9b7edd)
    .setTitle("Membre parti")
    .setThumbnail(member.user.displayAvatarURL())
    .setDescription(`${member.user.tag} (<@${member.id}>) a quitte le serveur.`)
    .setTimestamp();

  await sendLogEmbed(member.guild, embed);
}
