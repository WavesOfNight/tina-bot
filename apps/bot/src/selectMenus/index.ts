import type { SelectMenuHandler } from "../types.js";
import chess from "./chess.js";
import dames from "./dames.js";

export const selectMenuHandlers: SelectMenuHandler[] = [chess, dames];

export const selectMenuHandlerMap = new Map(selectMenuHandlers.map((handler) => [handler.prefix, handler]));
