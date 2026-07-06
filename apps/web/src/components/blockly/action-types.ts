export const ACTION_TYPE_TO_BLOCK: Record<string, string> = {
  SEND_MESSAGE: "tina_send_message",
  SEND_DM: "tina_send_dm",
  SEND_EMBED: "tina_send_embed",
  ADD_ROLE: "tina_add_role",
  REMOVE_ROLE: "tina_remove_role",
  ADD_REACTION: "tina_add_reaction",
  KICK: "tina_kick",
  BAN: "tina_ban",
  TIMEOUT: "tina_timeout",
  DELETE_MESSAGE: "tina_delete_message",
  STOP: "tina_stop",
  WAIT: "tina_wait",
  SET_VARIABLE: "tina_set_variable",
  IF: "tina_if",
  REPEAT: "tina_repeat",
  CREATE_CHANNEL: "tina_create_channel",
  DELETE_CHANNEL: "tina_delete_channel",
  CREATE_ROLE: "tina_create_role",
  DELETE_ROLE: "tina_delete_role",
  MOVE_VOICE: "tina_move_voice",
  HTTP_REQUEST: "tina_http_request",
  ADD_CURRENCY: "tina_add_currency",
  REMOVE_CURRENCY: "tina_remove_currency",
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
