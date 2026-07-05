import { revalidatePath } from "next/cache";
import { prisma } from "@tina/database";
import { getGuildChannels, getGuildRoles } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { Keyboard, ArrowUp, ArrowDown, X } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  SEND_MESSAGE: "Envoyer un message",
  SEND_DM: "Envoyer un message prive",
  SEND_EMBED: "Envoyer un embed",
  ADD_ROLE: "Ajouter un role",
  REMOVE_ROLE: "Retirer un role",
  ADD_REACTION: "Ajouter une reaction",
  WAIT: "Attendre",
  SET_VARIABLE: "Definir une variable",
  IF: "Condition (SI / SINON)",
  REPEAT: "Repeter",
  KICK: "Expulser l'auteur",
  BAN: "Bannir l'auteur",
};

const OPERATION_SYMBOLS: Record<string, string> = {
  SET: "=",
  ADD: "+=",
  SUBTRACT: "-=",
  RANDOM: "= aleatoire entre",
  APPEND: "+= (texte)",
};

function describeCondition(parsed: Record<string, unknown>): string {
  switch (String(parsed.conditionType ?? "")) {
    case "HAS_ROLE":
      return `a le role <@&${parsed.roleId}>`;
    case "IS_ADMIN":
      return "est administrateur";
    case "MESSAGE_CONTAINS":
      return `message contient "${parsed.text}"`;
    case "VARIABLE_EQUALS":
      return `{var:${parsed.variableName}} == ${parsed.compareValue}`;
    case "VARIABLE_GREATER":
      return `{var:${parsed.variableName}} > ${parsed.compareValue}`;
    case "RANDOM_CHANCE":
      return `${parsed.percent}% de chance`;
    default:
      return "";
  }
}

function describeAction(type: string, config: string): string {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(config);
  } catch {
    // ignore malformed config
  }

  switch (type) {
    case "SEND_MESSAGE":
      return `"${parsed.text ?? ""}"${parsed.channelId ? ` dans <#${parsed.channelId}>` : ""}`;
    case "SEND_DM":
      return `"${parsed.text ?? ""}"`;
    case "SEND_EMBED":
      return [parsed.title ? `titre: "${parsed.title}"` : null, parsed.description ? `"${parsed.description}"` : null]
        .filter(Boolean)
        .join(" - ") || "embed vide";
    case "ADD_ROLE":
    case "REMOVE_ROLE":
      return parsed.roleId ? `<@&${parsed.roleId}>` : "aucun role choisi";
    case "ADD_REACTION":
      return String(parsed.emoji ?? "");
    case "WAIT":
      return `${parsed.seconds ?? 0}s`;
    case "SET_VARIABLE":
      return `{var:${parsed.name ?? "?"}} ${OPERATION_SYMBOLS[String(parsed.operation ?? "SET")] ?? "="} ${parsed.value ?? ""}`;
    case "IF":
      return describeCondition(parsed);
    case "REPEAT":
      return `${parsed.count ?? 1} fois`;
    case "KICK":
    case "BAN":
      return parsed.reason ? `raison : ${parsed.reason}` : "sans raison";
    default:
      return "";
  }
}

interface RawAction {
  id: number;
  parentId: number | null;
  branch: string | null;
  type: string;
  config: string;
  order: number;
}

interface ActionNode extends RawAction {
  children: ActionNode[];
}

function buildTree(actions: RawAction[]): ActionNode[] {
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

async function addCommand(guildId: string, formData: FormData) {
  "use server";
  const name = (formData.get("name") as string).toLowerCase().trim().replace(/\s+/g, "-");
  const response = formData.get("response") as string;
  if (!name || !response) return;

  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.customCommand.upsert({
    where: { guildId_name: { guildId, name } },
    create: { guildId, name, response },
    update: { response },
  });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

async function deleteCommand(guildId: string, id: number) {
  "use server";
  await prisma.customCommand.delete({ where: { id } });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

async function addAction(
  guildId: string,
  customCommandId: number,
  parentId: number | null,
  branch: string | null,
  formData: FormData,
) {
  "use server";
  const type = formData.get("type") as string;
  if (!type || !(type in ACTION_LABELS)) return;

  const config: Record<string, unknown> = {};
  if (type === "SEND_MESSAGE" || type === "SEND_DM") {
    const text = (formData.get("text") as string)?.trim();
    if (!text) return;
    config.text = text;
    const channelId = formData.get("channelId") as string;
    if (type === "SEND_MESSAGE" && channelId) config.channelId = channelId;
  } else if (type === "SEND_EMBED") {
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    if (!title && !description) return;
    if (title) config.title = title;
    if (description) config.description = description;
    const color = (formData.get("color") as string)?.trim();
    if (color) config.color = color;
    const imageUrl = (formData.get("imageUrl") as string)?.trim();
    if (imageUrl) config.imageUrl = imageUrl;
    const channelId = formData.get("channelId") as string;
    if (channelId) config.channelId = channelId;
  } else if (type === "ADD_ROLE" || type === "REMOVE_ROLE") {
    const roleId = formData.get("roleId") as string;
    if (!roleId) return;
    config.roleId = roleId;
  } else if (type === "ADD_REACTION") {
    const emoji = (formData.get("emoji") as string)?.trim();
    if (!emoji) return;
    config.emoji = emoji;
  } else if (type === "WAIT") {
    config.seconds = Math.min(30, Math.max(0, Number(formData.get("seconds")) || 0));
  } else if (type === "SET_VARIABLE") {
    const name = (formData.get("name") as string)?.trim();
    if (!name) return;
    config.name = name;
    config.operation = (formData.get("operation") as string) || "SET";
    config.value = (formData.get("value") as string)?.trim() ?? "";
  } else if (type === "IF") {
    const conditionType = (formData.get("conditionType") as string) || "HAS_ROLE";
    config.conditionType = conditionType;
    if (conditionType === "HAS_ROLE") {
      const roleId = formData.get("roleId") as string;
      if (!roleId) return;
      config.roleId = roleId;
    } else if (conditionType === "MESSAGE_CONTAINS") {
      const text = (formData.get("text") as string)?.trim();
      if (!text) return;
      config.text = text;
    } else if (conditionType === "VARIABLE_EQUALS" || conditionType === "VARIABLE_GREATER") {
      const variableName = (formData.get("variableName") as string)?.trim();
      if (!variableName) return;
      config.variableName = variableName;
      config.compareValue = (formData.get("compareValue") as string)?.trim() ?? "";
    } else if (conditionType === "RANDOM_CHANCE") {
      config.percent = Math.min(100, Math.max(0, Number(formData.get("percent")) || 50));
    }
  } else if (type === "REPEAT") {
    config.count = Math.min(20, Math.max(1, Number(formData.get("count")) || 1));
  } else if (type === "KICK" || type === "BAN") {
    const reason = (formData.get("reason") as string)?.trim();
    if (reason) config.reason = reason;
  }

  const highest = await prisma.customCommandAction.aggregate({
    where: { customCommandId, parentId, branch },
    _max: { order: true },
  });
  await prisma.customCommandAction.create({
    data: { customCommandId, parentId, branch, type, order: (highest._max.order ?? -1) + 1, config: JSON.stringify(config) },
  });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

async function deleteAction(guildId: string, actionId: number) {
  "use server";
  await prisma.customCommandAction.delete({ where: { id: actionId } });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

async function moveAction(guildId: string, actionId: number, direction: "up" | "down") {
  "use server";
  const action = await prisma.customCommandAction.findUnique({ where: { id: actionId } });
  if (!action) return;

  const siblings = await prisma.customCommandAction.findMany({
    where: { customCommandId: action.customCommandId, parentId: action.parentId, branch: action.branch },
    orderBy: { order: "asc" },
  });
  const index = siblings.findIndex((a) => a.id === actionId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) return;

  const swapWith = siblings[swapIndex];
  await prisma.$transaction([
    prisma.customCommandAction.update({ where: { id: action.id }, data: { order: swapWith.order } }),
    prisma.customCommandAction.update({ where: { id: swapWith.id }, data: { order: action.order } }),
  ]);
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

async function addAutoResponse(guildId: string, formData: FormData) {
  "use server";
  const trigger = (formData.get("trigger") as string)?.trim();
  const response = (formData.get("autoResponse") as string)?.trim();
  const matchType = (formData.get("matchType") as string) === "EXACT" ? "EXACT" : "CONTAINS";
  if (!trigger || !response) return;

  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.autoResponse.create({ data: { guildId, trigger, response, matchType } });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

async function deleteAutoResponse(guildId: string, id: number) {
  "use server";
  await prisma.autoResponse.delete({ where: { id } });
  revalidatePath(`/dashboard/${guildId}/commandes`);
}

function ActionBlockList({
  nodes,
  channels,
  roles,
  moveAction: moveActionFn,
  deleteAction: deleteActionFn,
  addAction: addActionFn,
  depth = 0,
}: {
  nodes: ActionNode[];
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  moveAction: (actionId: number, direction: "up" | "down") => void;
  deleteAction: (actionId: number) => void;
  addAction: (parentId: number | null, branch: string | null, formData: FormData) => void;
  depth?: number;
}) {
  return (
    <div className={depth > 0 ? "space-y-2 border-l-2 border-lavender-200 pl-3" : "space-y-2"}>
      {nodes.map((node, index) => (
        <div key={node.id} className="rounded-lg bg-white/50 p-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div>
              <span className="mr-2 rounded-full bg-discord-100 px-2 py-0.5 font-medium text-discord-500">
                {index + 1}. {ACTION_LABELS[node.type] ?? node.type}
              </span>
              <span className="text-lavender-600">{describeAction(node.type, node.config)}</span>
            </div>
            <div className="flex items-center gap-1">
              <form action={moveActionFn.bind(null, node.id, "up")}>
                <button
                  type="submit"
                  disabled={index === 0}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-lavender-500 hover:bg-white disabled:opacity-30"
                >
                  <ArrowUp size={13} aria-hidden="true" />
                </button>
              </form>
              <form action={moveActionFn.bind(null, node.id, "down")}>
                <button
                  type="submit"
                  disabled={index === nodes.length - 1}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-lavender-500 hover:bg-white disabled:opacity-30"
                >
                  <ArrowDown size={13} aria-hidden="true" />
                </button>
              </form>
              <form action={deleteActionFn.bind(null, node.id)}>
                <button type="submit" className="flex h-6 w-6 items-center justify-center rounded-full text-coral-500 hover:bg-white">
                  <X size={13} aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>

          {node.type === "IF" && (
            <div className="mt-2 space-y-3 pl-2">
              <div>
                <p className="mb-1 text-[11px] font-medium text-aqua-700">✅ Si vrai :</p>
                <ActionBlockList
                  nodes={node.children.filter((c) => c.branch === "THEN")}
                  channels={channels}
                  roles={roles}
                  moveAction={moveActionFn}
                  deleteAction={deleteActionFn}
                  addAction={addActionFn}
                  depth={depth + 1}
                />
                <div className="mt-1">
                  <ActionForm action={addActionFn.bind(null, node.id, "THEN")} channels={channels} roles={roles} compact />
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-coral-600">❌ Sinon :</p>
                <ActionBlockList
                  nodes={node.children.filter((c) => c.branch === "ELSE")}
                  channels={channels}
                  roles={roles}
                  moveAction={moveActionFn}
                  deleteAction={deleteActionFn}
                  addAction={addActionFn}
                  depth={depth + 1}
                />
                <div className="mt-1">
                  <ActionForm action={addActionFn.bind(null, node.id, "ELSE")} channels={channels} roles={roles} compact />
                </div>
              </div>
            </div>
          )}

          {node.type === "REPEAT" && (
            <div className="mt-2 pl-2">
              <p className="mb-1 text-[11px] font-medium text-lavender-700">🔁 A repeter :</p>
              <ActionBlockList
                nodes={node.children.filter((c) => c.branch === "BODY")}
                channels={channels}
                roles={roles}
                moveAction={moveActionFn}
                deleteAction={deleteActionFn}
                addAction={addActionFn}
                depth={depth + 1}
              />
              <div className="mt-1">
                <ActionForm action={addActionFn.bind(null, node.id, "BODY")} channels={channels} roles={roles} compact />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function CommandesPage({ params }: { params: { guildId: string } }) {
  const guildId = params.guildId;
  const [commands, guild, autoResponses, channels, roles] = await Promise.all([
    prisma.customCommand.findMany({ where: { guildId }, orderBy: { name: "asc" }, include: { actions: true } }),
    prisma.guild.findUnique({ where: { id: guildId } }),
    prisma.autoResponse.findMany({ where: { guildId }, orderBy: { createdAt: "desc" } }),
    getGuildChannels(guildId, 0),
    getGuildRoles(guildId),
  ]);
  const prefix = guild?.prefix ?? "!";

  const add = addCommand.bind(null, guildId);

  return (
    <div>
      <PageHeader icon={Keyboard} title={`Commandes Perso (${commands.length})`} subtitle="Commandes texte et blocs d'actions (conditions, boucles, variables...)" />

      <form action={add} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Nom (sans prefixe)</label>
          <input name="name" required placeholder="regles" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Reponse simple (utilisee si aucun bloc n&apos;est ajoute)</label>
          <input name="response" required placeholder="Consulte le reglement dans #regles" className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-lavender-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Ajouter
        </button>
      </form>

      <div className="space-y-4">
        {commands.length === 0 && (
          <div className="glass-panel rounded-aero p-4 shadow-glass">
            <p className="text-sm text-lavender-600">Aucune commande personnalisee pour le moment.</p>
            <p className="mt-1 text-xs text-lavender-500">
              Cree-en une avec le formulaire ci-dessus (nom + reponse simple). Une fois creee, sa carte apparait ici avec
              en dessous le constructeur de blocs (message, embed, condition SI/SINON, boucle, variable, role, attendre...).
              Utilise {"{arg1}"} {"{arg2}"} {"{args}"} pour recuperer ce que l&apos;utilisateur a tape apres la commande, et{" "}
              {"{var:nom}"} pour lire une variable.
            </p>
          </div>
        )}
        {commands.map((c) => {
          const tree = buildTree(c.actions);
          const boundMoveAction = moveAction.bind(null, guildId);
          const boundDeleteAction = deleteAction.bind(null, guildId);
          const boundAddAction = addAction.bind(null, guildId, c.id);

          return (
            <div key={c.id} className="glass-panel rounded-aero p-4 shadow-glass">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-lavender-900">
                    {prefix}
                    {c.name}
                  </p>
                  {c.actions.length === 0 && <p className="text-sm text-lavender-600">{c.response}</p>}
                  {c.actions.length > 0 && (
                    <p className="text-xs text-discord-500">
                      Chaine de {c.actions.length} bloc{c.actions.length > 1 ? "s" : ""} (la reponse simple est ignoree)
                    </p>
                  )}
                </div>
                <form action={deleteCommand.bind(null, guildId, c.id)}>
                  <button type="submit" className="rounded-full bg-coral-100 px-3 py-1 text-xs font-medium text-coral-600">
                    Supprimer
                  </button>
                </form>
              </div>

              {tree.length > 0 && (
                <div className="mb-3">
                  <ActionBlockList
                    nodes={tree}
                    channels={channels}
                    roles={roles}
                    moveAction={boundMoveAction}
                    deleteAction={boundDeleteAction}
                    addAction={boundAddAction}
                  />
                </div>
              )}

              <ActionForm action={boundAddAction.bind(null, null, null)} channels={channels} roles={roles} />
            </div>
          );
        })}
      </div>

      <h2 className="font-display mb-4 mt-8 flex items-center gap-2 text-lg font-semibold text-lavender-900">
        <span aria-hidden="true">💬</span> Reponses automatiques ({autoResponses.length})
      </h2>
      <p className="mb-3 text-xs text-lavender-500">
        Contrairement aux commandes perso (declenchees par {prefix}nom), une reponse automatique se declenche des qu'un
        mot apparait dans un message normal.
      </p>

      <form action={addAutoResponse.bind(null, guildId)} className="glass-panel mb-4 flex flex-wrap items-end gap-3 rounded-aero p-5 shadow-glass">
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Mot declencheur</label>
          <input name="trigger" required placeholder="miaou" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-lavender-600">Reponse du bot</label>
          <input name="autoResponse" required placeholder="miaou !" className="w-full rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-lavender-600">Correspondance</label>
          <select name="matchType" className="rounded-xl border border-lavender-200 bg-white/80 px-3 py-2 text-sm">
            <option value="CONTAINS">Message contient le mot</option>
            <option value="EXACT">Message = exactement le mot</option>
          </select>
        </div>
        <button type="submit" className="bubble-btn rounded-full bg-aqua-400 px-5 py-2 text-sm font-medium text-white shadow-glass">
          Ajouter
        </button>
      </form>

      <div className="glass-panel rounded-aero p-2 shadow-glass">
        {autoResponses.length === 0 && <p className="p-4 text-sm text-lavender-600">Aucune reponse automatique pour le moment.</p>}
        {autoResponses.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 border-b border-lavender-100 px-4 py-3 last:border-none">
            <div>
              <p className="font-medium text-lavender-900">
                {r.matchType === "EXACT" ? `"${r.trigger}"` : `contient "${r.trigger}"`}
                <span className="ml-2 rounded-full bg-aqua-100 px-2 py-0.5 text-[10px] font-medium text-aqua-800">
                  {r.matchType === "EXACT" ? "mot exact" : "contient"}
                </span>
              </p>
              <p className="text-sm text-lavender-600">→ {r.response}</p>
            </div>
            <form action={deleteAutoResponse.bind(null, guildId, r.id)}>
              <button type="submit" className="rounded-full bg-coral-100 px-3 py-1 text-xs font-medium text-coral-600">
                Supprimer
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
