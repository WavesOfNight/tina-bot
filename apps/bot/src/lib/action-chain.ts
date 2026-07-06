import { ChannelType, EmbedBuilder, type Guild, type GuildMember, type Message } from "discord.js";
import { getGuildVariables, setGuildVariable, adjustBalance } from "@tina/database";
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
  stopped: boolean;
}

interface ActionNode extends StoredAction {
  children: ActionNode[];
}

const MAX_WAIT_SECONDS = 30;
const MAX_REPEAT_COUNT = 20;
const MAX_NESTING_DEPTH = 8;
const MAX_ACTIONS_PER_RUN = 200;
const MAX_TIMEOUT_MINUTES = 40_320; // Discord's own cap (28 days)

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
  const runtime: RuntimeContext = { ...ctx, variables, budget: { remaining: MAX_ACTIONS_PER_RUN }, stopped: false };
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
    if (ctx.budget.remaining <= 0 || ctx.stopped) return;
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
    case "HAS_ANY_ROLE": {
      const roleIds = String(config.roleIds ?? "").split(",").map((r) => r.trim()).filter(Boolean);
      return roleIds.some((roleId) => ctx.member.roles.cache.has(roleId));
    }
    case "IN_CHANNEL": {
      const channelId = String(config.channelId ?? "");
      return channelId ? ctx.message.channelId === channelId : false;
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
    case "MULTIPLY":
      next = String((Number(current) || 0) * (Number(rawValue) || 0));
      break;
    case "DIVIDE": {
      const divisor = Number(rawValue) || 0;
      next = divisor === 0 ? current : String((Number(current) || 0) / divisor);
      break;
    }
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

function getJsonPath(data: unknown, path: string): unknown {
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean);
  let current: unknown = data;
  for (const part of parts) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

async function applyHttpRequest(config: Record<string, unknown>, ctx: RuntimeContext): Promise<void> {
  const url = text(config, "url", ctx);
  const variableName = String(config.variableName ?? "").trim();
  if (!url || !variableName || !/^https?:\/\//i.test(url)) return;

  const method = String(config.method ?? "GET").toUpperCase() === "POST" ? "POST" : "GET";
  const res = await fetch(url, { method }).catch(() => null);
  if (!res || !res.ok) return;

  const jsonPath = String(config.jsonPath ?? "").trim();
  let value: unknown;
  try {
    const data = await res.json();
    value = jsonPath ? getJsonPath(data, jsonPath) : data;
  } catch {
    value = await res.text().catch(() => "");
  }

  const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  ctx.variables[variableName] = stringValue;
  await setGuildVariable(ctx.guild.id, variableName, stringValue).catch(() => null);
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
    case "TIMEOUT": {
      const minutes = Math.min(MAX_TIMEOUT_MINUTES, Math.max(1, Number(config.minutes) || 10));
      const reason = text(config, "reason", ctx) || "Commande personnalisee";
      await ctx.member.timeout(minutes * 60_000, reason).catch(() => null);
      break;
    }
    case "DELETE_MESSAGE": {
      if (ctx.message.deletable) await ctx.message.delete().catch(() => null);
      break;
    }
    case "STOP": {
      ctx.stopped = true;
      break;
    }
    case "CREATE_CHANNEL": {
      const name = text(config, "name", ctx).slice(0, 100);
      if (!name) break;
      const type = config.channelType === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
      await ctx.guild.channels.create({ name, type }).catch(() => null);
      break;
    }
    case "DELETE_CHANNEL": {
      const channelId = typeof config.channelId === "string" ? config.channelId : null;
      if (!channelId) break;
      const channel = await ctx.guild.channels.fetch(channelId).catch(() => null);
      await channel?.delete().catch(() => null);
      break;
    }
    case "CREATE_ROLE": {
      const name = text(config, "name", ctx).slice(0, 100);
      if (!name) break;
      const color = typeof config.color === "string" && /^#?[0-9a-fA-F]{6}$/.test(config.color) ? config.color.replace("#", "") : undefined;
      await ctx.guild.roles.create({ name, color: color ? (parseInt(color, 16) as number) : undefined }).catch(() => null);
      break;
    }
    case "DELETE_ROLE": {
      const roleId = typeof config.roleId === "string" ? config.roleId : null;
      if (!roleId) break;
      const role = await ctx.guild.roles.fetch(roleId).catch(() => null);
      await role?.delete().catch(() => null);
      break;
    }
    case "MOVE_VOICE": {
      const channelId = typeof config.channelId === "string" ? config.channelId : null;
      if (!channelId) break;
      await ctx.member.voice.setChannel(channelId).catch(() => null);
      break;
    }
    case "HTTP_REQUEST": {
      await applyHttpRequest(config, ctx);
      break;
    }
    case "ADD_CURRENCY": {
      const amount = Number(text(config, "amount", ctx)) || 0;
      if (amount > 0) await adjustBalance(ctx.guild.id, ctx.member.id, amount).catch(() => null);
      break;
    }
    case "REMOVE_CURRENCY": {
      const amount = Number(text(config, "amount", ctx)) || 0;
      if (amount > 0) await adjustBalance(ctx.guild.id, ctx.member.id, -amount).catch(() => null);
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
        if (ctx.budget.remaining <= 0 || ctx.stopped) return;
        ctx.variables["_loop_index"] = String(i + 1);
        await executeNodes(body, ctx, isBlocked, depth + 1);
      }
      break;
    }
  }
}
