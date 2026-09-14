import { Events, type DMChannel, type NonThreadGuildBasedChannel } from "discord.js";
import { prisma } from "@tina/database";
import { findChannelNameViolation, warnAndDeleteForBadName } from "../lib/hub-voice.js";

export const name = Events.ChannelUpdate;
export const once = false;

// Un membre ne peut renommer que son propre salon vocal personnel (seul lui a la
// permission Gerer les salons dessus, voir hub-voice.ts) - c'est donc le seul endroit ou
// un nom de salon change apres coup et doit etre revalide.
export async function execute(oldChannel: DMChannel | NonThreadGuildBasedChannel, newChannel: DMChannel | NonThreadGuildBasedChannel) {
  if (!newChannel.isVoiceBased() || !oldChannel.isVoiceBased()) return;
  if (oldChannel.name === newChannel.name) return;

  const record = await prisma.tempVoiceChannel.findUnique({ where: { channelId: newChannel.id } });
  if (!record) return;

  const violation = await findChannelNameViolation(newChannel.guild.id, newChannel.name);
  if (violation) await warnAndDeleteForBadName(newChannel.guild, newChannel, record.ownerId, violation);
}
