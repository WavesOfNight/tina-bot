import type { Command } from "../types.js";
import hello from "./fun/hello.js";
import hug from "./fun/hug.js";
import meme from "./fun/meme.js";
import morpion from "./games/morpion.js";
import loto from "./games/loto.js";
import puissance4 from "./games/puissance4.js";
import chifumi from "./games/chifumi.js";
import trivia from "./games/trivia.js";
import bombe from "./games/bombe.js";
import histoire from "./games/histoire.js";
import rumble from "./games/rumble.js";
import ban from "./moderation/ban.js";
import kick from "./moderation/kick.js";
import mute from "./moderation/mute.js";
import unmute from "./moderation/unmute.js";
import unban from "./moderation/unban.js";
import warn from "./moderation/warn.js";
import warnings from "./moderation/warnings.js";
import clear from "./moderation/clear.js";
import slowmode from "./moderation/slowmode.js";
import nickname from "./moderation/nickname.js";
import say from "./moderation/say.js";
import rank from "./leveling/rank.js";
import leaderboard from "./leveling/leaderboard.js";
import giveaway from "./giveaway/giveaway.js";
import customcommand from "./customcommand/customcommand.js";
import reactionrole from "./reactionrole/reactionrole.js";
import help from "./utility/help.js";
import ping from "./utility/ping.js";
import userinfo from "./utility/userinfo.js";
import serverinfo from "./utility/serverinfo.js";
import avatar from "./utility/avatar.js";
import roleinfo from "./utility/roleinfo.js";
import eightball from "./utility/8ball.js";
import poll from "./utility/poll.js";
import remindme from "./utility/remindme.js";

export const commands: Command[] = [
  hello,
  hug,
  meme,
  morpion,
  loto,
  puissance4,
  chifumi,
  trivia,
  bombe,
  histoire,
  rumble,
  ban,
  kick,
  mute,
  unmute,
  unban,
  warn,
  warnings,
  clear,
  slowmode,
  nickname,
  say,
  rank,
  leaderboard,
  giveaway,
  customcommand,
  reactionrole,
  help,
  ping,
  userinfo,
  serverinfo,
  avatar,
  roleinfo,
  eightball,
  poll,
  remindme,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
