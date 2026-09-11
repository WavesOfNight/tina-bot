import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type AudioPlayer,
  type AudioResource,
  type VoiceConnection,
} from "@discordjs/voice";
import type { Client, GuildTextBasedChannel } from "discord.js";
import { fileURLToPath } from "node:url";
import { synthesizeSpeech } from "./tts.js";

// Sources : Field_cricket_unedited.ogg (Thatcher, CC BY-SA 3.0, Wikimedia Commons),
// Medium_rooster_crowing.ogg (alys, domaine public, Wikimedia Commons), knife-blade-3
// (BigSoundBank, CC0).
const SOUND_EFFECTS = {
  night: fileURLToPath(new URL("../../assets/sfx/night-cricket.ogg", import.meta.url)),
  dawn: fileURLToPath(new URL("../../assets/sfx/dawn-rooster.ogg", import.meta.url)),
  death: fileURLToPath(new URL("../../assets/sfx/death-knife.mp3", import.meta.url)),
} as const;

export type SoundEffect = keyof typeof SOUND_EFFECTS;

interface NarratorSession {
  connection: VoiceConnection;
  player: AudioPlayer;
  channelId: string;
}

const sessions = new Map<string, NarratorSession>();

export async function joinNarratorChannel(client: Client, guildId: string, channelId: string): Promise<boolean> {
  const existing = sessions.get(guildId);
  if (existing && existing.channelId === channelId) return true;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return false;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isVoiceBased()) return false;

  const connection = joinVoiceChannel({
    channelId,
    guildId,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
  });
  connection.on("error", (error) => console.error(`[loupgarou-voice-error ${guildId}]`, error));

  const player = existing?.player ?? createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
  if (!existing) player.on("error", (error) => console.error(`[loupgarou-player-error ${guildId}]`, error));
  connection.subscribe(player);

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch (error) {
    console.error(`Connexion vocale impossible pour le loup-garou (guilde ${guildId})`, error);
    connection.destroy();
    return false;
  }

  sessions.set(guildId, { connection, player, channelId });
  return true;
}

function playAndWait(player: AudioPlayer, resource: AudioResource): Promise<void> {
  return new Promise((resolve) => {
    const cleanup = () => {
      player.off(AudioPlayerStatus.Idle, onIdle);
      player.off("error", onError);
    };
    const onIdle = () => {
      cleanup();
      resolve();
    };
    const onError = (error: unknown) => {
      console.error("Erreur de lecture TTS", error);
      cleanup();
      resolve();
    };
    player.once(AudioPlayerStatus.Idle, onIdle);
    player.once("error", onError);
    player.play(resource);
  });
}

// Joue la ligne en voix (best-effort, n'echoue jamais) - a utiliser seulement apres
// joinNarratorChannel(). Si la synthese ou la lecture echoue, se resout quand meme
// pour ne jamais bloquer la progression de la partie.
export async function say(guildId: string, text: string): Promise<void> {
  const session = sessions.get(guildId);
  if (!session) return;
  try {
    const resource = await synthesizeSpeech(text);
    await playAndWait(session.player, resource);
  } catch (error) {
    console.error(`Echec de la synthese vocale (guilde ${guildId})`, error);
  }
}

// Poste toujours le texte dans le salon (source de verite), et tente en plus la voix.
export async function narrate(guildId: string, textChannel: GuildTextBasedChannel, text: string): Promise<void> {
  await textChannel.send(text).catch(() => null);
  await say(guildId, text);
}

// Joue un petit effet sonore d'ambiance (best-effort, comme say()). Fichiers locaux geres
// nativement par @discordjs/voice (transcodage ffmpeg automatique), pas besoin du pipeline
// TTS.
export async function playSoundEffect(guildId: string, effect: SoundEffect): Promise<void> {
  const session = sessions.get(guildId);
  if (!session) return;
  try {
    const resource = createAudioResource(SOUND_EFFECTS[effect]);
    await playAndWait(session.player, resource);
  } catch (error) {
    console.error(`Echec de la lecture de l'effet sonore "${effect}" (guilde ${guildId})`, error);
  }
}

export function leaveNarratorChannel(guildId: string): void {
  const session = sessions.get(guildId);
  if (!session) return;
  sessions.delete(guildId);
  session.player.stop(true);
  session.connection.destroy();
}
