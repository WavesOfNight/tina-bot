import * as ready from "./ready.js";
import * as guildMemberAdd from "./guildMemberAdd.js";
import * as messageCreate from "./messageCreate.js";
import * as interactionCreate from "./interactionCreate.js";

export const events = [ready, guildMemberAdd, messageCreate, interactionCreate];
