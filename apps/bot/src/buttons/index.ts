import type { ButtonHandler } from "../types.js";
import morpion from "./morpion.js";
import giveaway from "./giveaway.js";
import reactionrole from "./reactionrole.js";
import welcome from "./welcome.js";

export const buttonHandlers: ButtonHandler[] = [morpion, giveaway, reactionrole, welcome];

export const buttonHandlerMap = new Map(buttonHandlers.map((handler) => [handler.prefix, handler]));
