import type { Guild, GuildMember } from "discord.js";

export interface PlaceholderContext {
  args?: string[];
  variables?: Record<string, string>;
}

export function applyPlaceholders(
  template: string,
  member: GuildMember,
  guild: Guild,
  context: PlaceholderContext = {},
): string {
  const args = context.args ?? [];
  const variables = context.variables ?? {};

  let result = template
    .replaceAll("{user.mention}", `<@${member.id}>`)
    .replaceAll("{user.name}", member.user.username)
    .replaceAll("{user.tag}", member.user.tag)
    .replaceAll("{user}", member.user.username)
    .replaceAll("{server.name}", guild.name)
    .replaceAll("{server.memberCount}", guild.memberCount.toString())
    .replaceAll("{server}", guild.name)
    .replaceAll("{args}", args.join(" "));

  for (let i = 0; i < 9; i++) {
    result = result.replaceAll(`{arg${i + 1}}`, args[i] ?? "");
  }

  result = result.replace(/\{var:([a-zA-Z0-9_]+)\}/g, (_match, name: string) => variables[name] ?? "");

  return result;
}
