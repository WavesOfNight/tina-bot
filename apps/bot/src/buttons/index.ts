import type { ButtonHandler } from "../types.js";
import morpion from "./morpion.js";
import puissance4 from "./puissance4.js";
import chifumi from "./chifumi.js";
import trivia from "./trivia.js";
import rumble from "./rumble.js";
import poll from "./poll.js";
import giveaway from "./giveaway.js";
import reactionrole from "./reactionrole.js";
import welcome from "./welcome.js";
import blackjack from "./blackjack.js";
import ticket from "./ticket.js";
import chess from "./chess.js";
import dames from "./dames.js";

export const buttonHandlers: ButtonHandler[] = [
  morpion,
  puissance4,
  chifumi,
  trivia,
  rumble,
  poll,
  giveaway,
  reactionrole,
  welcome,
  blackjack,
  ticket,
  chess,
  dames,
];

export const buttonHandlerMap = new Map(buttonHandlers.map((handler) => [handler.prefix, handler]));
