import { ACTION_TYPE_TO_BLOCK, STATEMENT_NAMES, type ActionNode } from "./action-types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface FieldSpec {
  name: string;
  value: string;
}

function fieldsForNode(type: string, config: Record<string, unknown>): FieldSpec[] {
  switch (type) {
    case "SEND_MESSAGE":
      return [
        { name: "TEXT", value: String(config.text ?? "") },
        { name: "CHANNEL", value: String(config.channelId ?? "") },
      ];
    case "SEND_DM":
      return [{ name: "TEXT", value: String(config.text ?? "") }];
    case "SEND_EMBED":
      return [
        { name: "TITLE", value: String(config.title ?? "") },
        { name: "DESCRIPTION", value: String(config.description ?? "") },
        { name: "COLOR", value: String(config.color ?? "#5865F2") },
        { name: "IMAGE_URL", value: String(config.imageUrl ?? "") },
        { name: "CHANNEL", value: String(config.channelId ?? "") },
      ];
    case "ADD_ROLE":
    case "REMOVE_ROLE":
      return [{ name: "ROLE_ID", value: String(config.roleId ?? "") }];
    case "ADD_REACTION":
      return [{ name: "EMOJI", value: String(config.emoji ?? "🎉") }];
    case "KICK":
    case "BAN":
      return [{ name: "REASON", value: String(config.reason ?? "") }];
    case "WAIT":
      return [{ name: "SECONDS", value: String(config.seconds ?? 2) }];
    case "SET_VARIABLE":
      return [
        { name: "NAME", value: String(config.name ?? "") },
        { name: "OPERATION", value: String(config.operation ?? "SET") },
        { name: "VALUE", value: String(config.value ?? "") },
      ];
    case "IF":
      return [
        { name: "CONDITION_TYPE", value: String(config.conditionType ?? "HAS_ROLE") },
        { name: "ROLE_ID", value: String(config.roleId ?? "") },
        { name: "TEXT", value: String(config.text ?? "") },
        { name: "VARIABLE_NAME", value: String(config.variableName ?? "") },
        { name: "COMPARE_VALUE", value: String(config.compareValue ?? "") },
        { name: "PERCENT", value: String(config.percent ?? 50) },
      ];
    case "REPEAT":
      return [{ name: "COUNT", value: String(config.count ?? 3) }];
    default:
      return [];
  }
}

function nodeToXml(node: ActionNode): string {
  const blockType = ACTION_TYPE_TO_BLOCK[node.type];
  if (!blockType) return "";

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(node.config || "{}");
  } catch {
    // ignore malformed config
  }

  const fields = fieldsForNode(node.type, config)
    .map((f) => `<field name="${f.name}">${escapeXml(f.value)}</field>`)
    .join("");

  const statementNames = STATEMENT_NAMES[node.type] ?? [];
  const statements = statementNames
    .map((branchName) => {
      const children = node.children.filter((c) => c.branch === branchName);
      const inner = childrenToXml(children);
      return inner ? `<statement name="${branchName}">${inner}</statement>` : "";
    })
    .join("");

  return `<block type="${blockType}">${fields}${statements}</block>`;
}

function childrenToXml(nodes: ActionNode[]): string {
  if (nodes.length === 0) return "";
  const sorted = [...nodes].sort((a, b) => a.order - b.order);

  function build(index: number): string {
    if (index >= sorted.length) return "";
    const blockXml = nodeToXml(sorted[index]);
    if (!blockXml) return build(index + 1);
    const nextXml = build(index + 1);
    const nextTag = nextXml ? `<next>${nextXml}</next>` : "";
    return blockXml.replace(/<\/block>$/, `${nextTag}</block>`);
  }

  return build(0);
}

export function treeToBlocklyXml(nodes: ActionNode[]): string {
  const chainXml = childrenToXml(nodes);
  return `<xml xmlns="https://developers.google.com/blockly/xml">${chainXml}</xml>`;
}
