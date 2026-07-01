import type { ButtonHandler } from "../types.js";
import morpion from "./morpion.js";
import puissance4 from "./puissance4.js";
import chifumi from "./chifumi.js";
import trivia from "./trivia.js";
import rumble from "./rumble.js";
import giveaway from "./giveaway.js";
import reactionrole from "./reactionrole.js";
import welcome from "./welcome.js";

export const buttonHandlers: ButtonHandler[] = [morpion, puissance4, chifumi, trivia, rumble, giveaway, reactionrole, welcome];

export const buttonHandlerMap = new Map(buttonHandlers.map((handler) => [handler.prefix, handler]));
