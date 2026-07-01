import type { Guild, GuildMember } from "discord.js";

export function applyPlaceholders(template: string, member: GuildMember, guild: Guild): string {
  return template
    .replaceAll("{user.mention}", `<@${member.id}>`)
    .replaceAll("{user.name}", member.user.username)
    .replaceAll("{user.tag}", member.user.tag)
    .replaceAll("{user}", member.user.username)
    .replaceAll("{server.name}", guild.name)
    .replaceAll("{server.memberCount}", guild.memberCount.toString())
    .replaceAll("{server}", guild.name);
}
