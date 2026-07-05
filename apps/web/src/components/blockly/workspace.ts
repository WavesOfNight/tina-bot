import type * as Blockly from "blockly";
import { BLOCK_TYPE_TO_ACTION, STATEMENT_NAMES, type SubmittedAction } from "./action-types";

function fieldsToConfig(actionType: string, block: Blockly.Block): Record<string, unknown> {
  switch (actionType) {
    case "SEND_MESSAGE": {
      const config: Record<string, unknown> = { text: block.getFieldValue("TEXT") || "" };
      const channelId = block.getFieldValue("CHANNEL");
      if (channelId) config.channelId = channelId;
      return config;
    }
    case "SEND_DM":
      return { text: block.getFieldValue("TEXT") || "" };
    case "SEND_EMBED": {
      const config: Record<string, unknown> = {};
      const title = block.getFieldValue("TITLE");
      if (title) config.title = title;
      const description = block.getFieldValue("DESCRIPTION");
      if (description) config.description = description;
      const color = block.getFieldValue("COLOR");
      if (color) config.color = color;
      const imageUrl = block.getFieldValue("IMAGE_URL");
      if (imageUrl) config.imageUrl = imageUrl;
      const channelId = block.getFieldValue("CHANNEL");
      if (channelId) config.channelId = channelId;
      return config;
    }
    case "ADD_ROLE":
    case "REMOVE_ROLE":
      return { roleId: block.getFieldValue("ROLE_ID") || "" };
    case "ADD_REACTION":
      return { emoji: block.getFieldValue("EMOJI") || "" };
    case "KICK":
    case "BAN": {
      const reason = block.getFieldValue("REASON");
      return reason ? { reason } : {};
    }
    case "WAIT":
      return { seconds: Math.min(30, Math.max(0, Number(block.getFieldValue("SECONDS")) || 0)) };
    case "SET_VARIABLE":
      return {
        name: block.getFieldValue("NAME") || "",
        operation: block.getFieldValue("OPERATION") || "SET",
        value: block.getFieldValue("VALUE") || "",
      };
    case "IF": {
      const conditionType = block.getFieldValue("CONDITION_TYPE") || "HAS_ROLE";
      const config: Record<string, unknown> = { conditionType };
      if (conditionType === "HAS_ROLE") {
        config.roleId = block.getFieldValue("ROLE_ID") || "";
      } else if (conditionType === "MESSAGE_CONTAINS") {
        config.text = block.getFieldValue("TEXT") || "";
      } else if (conditionType === "VARIABLE_EQUALS" || conditionType === "VARIABLE_GREATER") {
        config.variableName = block.getFieldValue("VARIABLE_NAME") || "";
        config.compareValue = block.getFieldValue("COMPARE_VALUE") || "";
      } else if (conditionType === "RANDOM_CHANCE") {
        config.percent = Math.min(100, Math.max(0, Number(block.getFieldValue("PERCENT")) || 50));
      }
      return config;
    }
    case "REPEAT":
      return { count: Math.min(20, Math.max(1, Number(block.getFieldValue("COUNT")) || 1)) };
    default:
      return {};
  }
}

function walkChain(
  firstBlock: Blockly.Block | null,
  parentClientId: string | null,
  branch: string | null,
  out: SubmittedAction[],
  counter: { value: number },
): void {
  let block = firstBlock;
  while (block) {
    const actionType = BLOCK_TYPE_TO_ACTION[block.type];
    if (actionType) {
      const clientId = block.id;
      out.push({
        clientId,
        parentClientId,
        branch,
        type: actionType,
        config: fieldsToConfig(actionType, block),
        order: counter.value,
      });
      counter.value += 1;

      for (const name of STATEMENT_NAMES[actionType] ?? []) {
        const child = block.getInputTargetBlock(name);
        walkChain(child, clientId, name, out, { value: 0 });
      }
    }
    block = block.getNextBlock();
  }
}

export function workspaceToTree(workspace: Blockly.WorkspaceSvg): SubmittedAction[] {
  const out: SubmittedAction[] = [];
  const topBlocks = workspace.getTopBlocks(true);
  const sorted = [...topBlocks].sort((a, b) => a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y);

  const rootCounter = { value: 0 };
  for (const block of sorted) {
    walkChain(block, null, null, out, rootCounter);
  }
  return out;
}
