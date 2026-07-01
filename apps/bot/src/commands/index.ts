import type { Command } from "../types.js";
import hello from "./fun/hello.js";
import hug from "./fun/hug.js";
import morpion from "./games/morpion.js";
import loto from "./games/loto.js";
import ban from "./moderation/ban.js";
import kick from "./moderation/kick.js";
import mute from "./moderation/mute.js";
import warn from "./moderation/warn.js";
import warnings from "./moderation/warnings.js";
import clear from "./moderation/clear.js";
import rank from "./leveling/rank.js";
import leaderboard from "./leveling/leaderboard.js";
import giveaway from "./giveaway/giveaway.js";
import customcommand from "./customcommand/customcommand.js";
import reactionrole from "./reactionrole/reactionrole.js";
import help from "./utility/help.js";

export const commands: Command[] = [
  hello,
  hug,
  morpion,
  loto,
  ban,
  kick,
  mute,
  warn,
  warnings,
  clear,
  rank,
  leaderboard,
  giveaway,
  customcommand,
  reactionrole,
  help,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
