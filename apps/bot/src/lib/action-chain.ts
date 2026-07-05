import { EmbedBuilder, type Guild, type GuildMember, type Message } from "discord.js";
import { getGuildVariables, setGuildVariable } from "@tina/database";
import { applyPlaceholders } from "./placeholders.js";

export interface StoredAction {
  id: number;
  parentId: number | null;
  branch: string | null;
  type: string;
  config: string;
  order: number;
}

export interface ExecutionContext {
  message: Message;
  member: GuildMember;
  guild: Guild;
  args: string[];
}

interface RuntimeContext extends ExecutionContext {
  variables: Record<string, string>;
  budget: { remaining: number };
}

interface ActionNode extends StoredAction {
  children: ActionNode[];
}

const MAX_WAIT_SECONDS = 30;
const MAX_REPEAT_COUNT = 20;
const MAX_NESTING_DEPTH = 8;
const MAX_ACTIONS_PER_RUN = 200;

function buildTree(actions: StoredAction[]): ActionNode[] {
  const nodes = new Map<number, ActionNode>();
  for (const action of actions) nodes.set(action.id, { ...action, children: [] });

  const roots: ActionNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId != null ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const byOrder = (a: ActionNode, b: ActionNode) => a.order - b.order;
  roots.sort(byOrder);
  for (const node of nodes.values()) node.children.sort(byOrder);

  return roots;
}

export async function runActionChain(
  actions: StoredAction[],
  ctx: ExecutionContext,
  isBlocked: (text: string) => boolean,
): Promise<void> {
  const tree = buildTree(actions);
  const variables = await getGuildVariables(ctx.guild.id);
  const runtime: RuntimeContext = { ...ctx, variables, budget: { remaining: MAX_ACTIONS_PER_RUN } };
  await executeNodes(tree, runtime, isBlocked, 0);
}

async function executeNodes(
  nodes: ActionNode[],
  ctx: RuntimeContext,
  isBlocked: (text: string) => boolean,
  depth: number,
): Promise<void> {
  if (depth > MAX_NESTING_DEPTH) return;

  for (const node of nodes) {
    if (ctx.budget.remaining <= 0) return;
    ctx.budget.remaining -= 1;
    try {
      await runSingleAction(node, ctx, isBlocked, depth);
    } catch (error) {
      console.error(`Erreur lors de l'execution de l'action ${node.type}`, error);
    }
  }
}

function text(config: Record<string, unknown>, key: string, ctx: RuntimeContext): string {
  return applyPlaceholders(String(config[key] ?? ""), ctx.member, ctx.guild, { args: ctx.args, variables: ctx.variables });
}

function evaluateCondition(config: Record<string, unknown>, ctx: RuntimeContext): boolean {
  switch (String(config.conditionType ?? "")) {
    case "HAS_ROLE": {
      const roleId = String(config.roleId ?? "");
      return roleId ? ctx.member.roles.cache.has(roleId) : false;
    }
    case "IS_ADMIN":
      return ctx.member.permissions.has("Administrator");
    case "MESSAGE_CONTAINS": {
      const needle = String(config.text ?? "").toLowerCase();
      return needle ? ctx.message.content.toLowerCase().includes(needle) : false;
    }
    case "VARIABLE_EQUALS": {
      const name = String(config.variableName ?? "");
      const compare = text(config, "compareValue", ctx);
      return (ctx.variables[name] ?? "") === compare;
    }
    case "VARIABLE_GREATER": {
      const name = String(config.variableName ?? "");
      const compare = Number(text(config, "compareValue", ctx)) || 0;
      return (Number(ctx.variables[name]) || 0) > compare;
    }
    case "RANDOM_CHANCE": {
      const percent = Math.min(100, Math.max(0, Number(config.percent) || 50));
      return Math.random() * 100 < percent;
    }
    default:
      return false;
  }
}

async function applySetVariable(config: Record<string, unknown>, ctx: RuntimeContext): Promise<void> {
  const name = String(config.name ?? "").trim();
  if (!name) return;

  const operation = String(config.operation ?? "SET");
  const rawValue = text(config, "value", ctx);
  const current = ctx.variables[name] ?? "";
  let next: string;

  switch (operation) {
    case "ADD":
      next = String((Number(current) || 0) + (Number(rawValue) || 0));
      break;
    case "SUBTRACT":
      next = String((Number(current) || 0) - (Number(rawValue) || 0));
      break;
    case "RANDOM": {
      const [minRaw, maxRaw] = rawValue.split(",").map((part) => part.trim());
      const min = Number(minRaw) || 0;
      const max = Number(maxRaw) || 100;
      next = String(Math.floor(Math.random() * (max - min + 1)) + min);
      break;
    }
    case "APPEND":
      next = `${current}${rawValue}`;
      break;
    default:
      next = rawValue;
  }

  ctx.variables[name] = next;
  await setGuildVariable(ctx.guild.id, name, next).catch(() => null);
}

async function sendToChannel(
  ctx: RuntimeContext,
  channelId: string | null,
  payload: string | { embeds: EmbedBuilder[] },
): Promise<void> {
  const channel = channelId ? await ctx.guild.channels.fetch(channelId).catch(() => null) : ctx.message.channel;
  if (channel?.isTextBased() && !channel.isThread() && "send" in channel) await channel.send(payload).catch(() => null);
}

async function runSingleAction(
  node: ActionNode,
  ctx: RuntimeContext,
  isBlocked: (text: string) => boolean,
  depth: number,
): Promise<void> {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(node.config || "{}");
  } catch {
    return;
  }

  switch (node.type) {
    case "SEND_MESSAGE": {
      const message = text(config, "text", ctx);
      if (!message || isBlocked(message)) return;
      const channelId = typeof config.channelId === "string" ? config.channelId : null;
      await sendToChannel(ctx, channelId, message);
      break;
    }
    case "SEND_DM": {
      const message = text(config, "text", ctx);
      if (!message || isBlocked(message)) return;
      await ctx.member.send(message).catch(() => null);
      break;
    }
    case "SEND_EMBED": {
      const title = text(config, "title", ctx);
      const description = text(config, "description", ctx);
      if (isBlocked(title) || isBlocked(description)) return;

      const colorMatch = typeof config.color === "string" ? config.color.replace("#", "") : "";
      const color = /^[0-9a-fA-F]{6}$/.test(colorMatch) ? parseInt(colorMatch, 16) : 0x5865f2;
      const embed = new EmbedBuilder().setColor(color);
      if (title) embed.setTitle(title.slice(0, 256));
      if (description) embed.setDescription(description.slice(0, 4096));
      if (typeof config.imageUrl === "string" && config.imageUrl) embed.setImage(config.imageUrl);

      const channelId = typeof config.channelId === "string" ? config.channelId : null;
      await sendToChannel(ctx, channelId, { embeds: [embed] });
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
      const reason = text(config, "reason", ctx) || "Commande personnalisee";
      await ctx.member.kick(reason).catch(() => null);
      break;
    }
    case "BAN": {
      const reason = text(config, "reason", ctx) || "Commande personnalisee";
      await ctx.member.ban({ reason }).catch(() => null);
      break;
    }
    case "SET_VARIABLE": {
      await applySetVariable(config, ctx);
      break;
    }
    case "IF": {
      const branch = evaluateCondition(config, ctx) ? "THEN" : "ELSE";
      const children = node.children.filter((child) => child.branch === branch);
      await executeNodes(children, ctx, isBlocked, depth + 1);
      break;
    }
    case "REPEAT": {
      const count = Math.min(MAX_REPEAT_COUNT, Math.max(1, Number(config.count) || 1));
      const body = node.children.filter((child) => child.branch === "BODY");
      for (let i = 0; i < count; i++) {
        if (ctx.budget.remaining <= 0) return;
        ctx.variables["_loop_index"] = String(i + 1);
        await executeNodes(body, ctx, isBlocked, depth + 1);
      }
      break;
    }
  }
}
