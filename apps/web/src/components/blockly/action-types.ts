export const ACTION_TYPE_TO_BLOCK: Record<string, string> = {
  SEND_MESSAGE: "tina_send_message",
  SEND_DM: "tina_send_dm",
  SEND_EMBED: "tina_send_embed",
  ADD_ROLE: "tina_add_role",
  REMOVE_ROLE: "tina_remove_role",
  ADD_REACTION: "tina_add_reaction",
  KICK: "tina_kick",
  BAN: "tina_ban",
  WAIT: "tina_wait",
  SET_VARIABLE: "tina_set_variable",
  IF: "tina_if",
  REPEAT: "tina_repeat",
};

export const BLOCK_TYPE_TO_ACTION: Record<string, string> = Object.fromEntries(
  Object.entries(ACTION_TYPE_TO_BLOCK).map(([action, block]) => [block, action]),
);

export const STATEMENT_NAMES: Record<string, string[]> = {
  IF: ["THEN", "ELSE"],
  REPEAT: ["BODY"],
};

export interface RawAction {
  id: number;
  parentId: number | null;
  branch: string | null;
  type: string;
  config: string;
  order: number;
}

export interface ActionNode extends RawAction {
  children: ActionNode[];
}

export function buildActionTree(actions: RawAction[]): ActionNode[] {
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

export interface SubmittedAction {
  clientId: string;
  parentClientId: string | null;
  branch: string | null;
  type: string;
  config: Record<string, unknown>;
  order: number;
}
