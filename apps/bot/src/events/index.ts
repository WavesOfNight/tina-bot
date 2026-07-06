import * as ready from "./ready.js";
import * as guildMemberAdd from "./guildMemberAdd.js";
import * as guildMemberRemove from "./guildMemberRemove.js";
import * as messageCreate from "./messageCreate.js";
import * as messageDelete from "./messageDelete.js";
import * as messageUpdate from "./messageUpdate.js";
import * as messageReactionAdd from "./messageReactionAdd.js";
import * as interactionCreate from "./interactionCreate.js";

export const events = [
  ready,
  guildMemberAdd,
  guildMemberRemove,
  messageCreate,
  messageDelete,
  messageUpdate,
  messageReactionAdd,
  interactionCreate,
];
