import type { Guild, GuildMember, Message } from "discord.js";
import { applyPlaceholders } from "./placeholders.js";

export interface StoredAction {
  type: string;
  config: string;
  order: number;
}

interface ExecutionContext {
  message: Message;
  member: GuildMember;
  guild: Guild;
}

const MAX_WAIT_SECONDS = 30;

export async function runActionChain(
  actions: StoredAction[],
  ctx: ExecutionContext,
  isBlocked: (text: string) => boolean,
): Promise<void> {
  const sorted = [...actions].sort((a, b) => a.order - b.order);

  for (const action of sorted) {
    try {
      await runSingleAction(action, ctx, isBlocked);
    } catch (error) {
      console.error(`Erreur lors de l'execution de l'action ${action.type}`, error);
    }
  }
}

async function runSingleAction(action: StoredAction, ctx: ExecutionContext, isBlocked: (text: string) => boolean): Promise<void> {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(action.config || "{}");
  } catch {
    return;
  }

  switch (action.type) {
    case "SEND_MESSAGE": {
      const text = applyPlaceholders(String(config.text ?? ""), ctx.member, ctx.guild);
      if (!text || isBlocked(text)) return;

      const channelId = typeof config.channelId === "string" ? config.channelId : null;
      const channel = channelId ? await ctx.guild.channels.fetch(channelId).catch(() => null) : ctx.message.channel;
      if (channel?.isTextBased() && !channel.isThread() && "send" in channel) await channel.send(text).catch(() => null);
      break;
    }
    case "SEND_DM": {
      const text = applyPlaceholders(String(config.text ?? ""), ctx.member, ctx.guild);
      if (!text || isBlocked(text)) return;
      await ctx.member.send(text).catch(() => null);
      break;
    }
    case "ADD_ROLE": {
      if (typeof config.roleId === "string") await ctx.member.roles.add(config.roleId).catch(() => null);
      break;
    }
    case "REMOVE_ROLE": {
      if (typeof config.roleId === "string") await ctx.member.roles.remove(config.roleId).catch(() => null);
      break;
    }
    case "ADD_REACTION": {
      if (typeof config.emoji === "string" && config.emoji) await ctx.message.react(config.emoji).catch(() => null);
      break;
    }
    case "WAIT": {
      const seconds = Math.min(MAX_WAIT_SECONDS, Math.max(0, Number(config.seconds) || 0));
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      break;
    }
    case "KICK": {
      const reason = typeof config.reason === "string" && config.reason ? config.reason : "Commande personnalisee";
      await ctx.member.kick(reason).catch(() => null);
      break;
    }
    case "BAN": {
      const reason = typeof config.reason === "string" && config.reason ? config.reason : "Commande personnalisee";
      await ctx.member.ban({ reason }).catch(() => null);
      break;
    }
  }
}
