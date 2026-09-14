import { Events, type VoiceState } from "discord.js";
import { prisma } from "@tina/database";
import { createTempVoiceChannel, deleteIfEmpty } from "../lib/hub-voice.js";

export const name = Events.VoiceStateUpdate;
export const once = false;

export async function execute(oldState: VoiceState, newState: VoiceState) {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;
  const guild = newState.guild;

  if (newState.channelId && newState.channelId !== oldState.channelId) {
    const guildData = await prisma.guild.findUnique({ where: { id: guild.id } });
    if (guildData?.hubVoiceChannelId && newState.channelId === guildData.hubVoiceChannelId && newState.channel?.isVoiceBased()) {
      const created = await createTempVoiceChannel(guild, member, newState.channel);
      if (created) await newState.member?.voice.setChannel(created.id).catch(() => null);
    }
  }

  if (oldState.channelId && oldState.channelId !== newState.channelId && oldState.channel?.isVoiceBased()) {
    await deleteIfEmpty(oldState.channel);
  }
}
