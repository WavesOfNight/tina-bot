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
import { synthesizeSpeech, type BackgroundLayer } from "./tts.js";

// Sources (toutes CC0 sauf mention contraire) : Field_cricket_unedited.ogg (Thatcher,
// CC BY-SA 3.0, Wikimedia Commons), knife-blade-3, cock-song-1, archery, water-bubble-2
// (BigSoundBank), chimes-dream-8 (LaSonotheque, meme licence CC0). Cupidon reutilise le
// meme bruit d'arc que le Chasseur (l'image classique de la fleche de Cupidon), joue
// deux fois - une par amoureux designe.
const SOUND_EFFECTS = {
  night: fileURLToPath(new URL("../../assets/sfx/night-cricket.ogg", import.meta.url)),
  dawn: fileURLToPath(new URL("../../assets/sfx/dawn-rooster.mp3", import.meta.url)),
  death: fileURLToPath(new URL("../../assets/sfx/death-knife.mp3", import.meta.url)),
  voyante: fileURLToPath(new URL("../../assets/sfx/role-voyante.mp3", import.meta.url)),
  sorciere: fileURLToPath(new URL("../../assets/sfx/role-sorciere.mp3", import.meta.url)),
  cupidon: fileURLToPath(new URL("../../assets/sfx/role-chasseur.mp3", import.meta.url)),
  chasseur: fileURLToPath(new URL("../../assets/sfx/role-chasseur.mp3", import.meta.url)),
} as const;

export type SoundEffect = keyof typeof SOUND_EFFECTS;

// Fond sonore melange sous la voix pendant la nuit/le jour : ambiance (vent nocturne,
// place de village - BigSoundBank CC0) + musique douce fournie par l'utilisateur.
const AMBIANCE_VOLUME = 0.15;
const MUSIC_VOLUME = 0.12;

const AMBIANCES: Record<"night" | "day", BackgroundLayer[]> = {
  night: [
    { path: fileURLToPath(new URL("../../assets/sfx/ambiance-night.mp3", import.meta.url)), volume: AMBIANCE_VOLUME },
    { path: fileURLToPath(new URL("../../assets/music/night.mp3", import.meta.url)), volume: MUSIC_VOLUME },
  ],
  day: [
    { path: fileURLToPath(new URL("../../assets/sfx/ambiance-day.mp3", import.meta.url)), volume: AMBIANCE_VOLUME },
    { path: fileURLToPath(new URL("../../assets/music/day.mp3", import.meta.url)), volume: MUSIC_VOLUME },
  ],
};

export type Ambiance = keyof typeof AMBIANCES | null;

interface NarratorSession {
  connection: VoiceConnection;
  player: AudioPlayer;
  channelId: string;
  ambiance: Ambiance;
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

  sessions.set(guildId, { connection, player, channelId, ambiance: existing?.ambiance ?? null });
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

// Le texte narre est ecrit pour le salon (gras markdown, emoji) - la synthese vocale ne
// doit recevoir que du texte brut, sinon elle epelle "etoile etoile" et le nom des emoji.
const EMOJI_PATTERN =
  /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

function stripForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/[*_~`]/g, "")
    .replace(EMOJI_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Change l'ambiance sonore melangee sous les prochaines lignes parlees (null = aucune).
// N'affecte pas les effets sonores ponctuels (playSoundEffect).
export function setAmbiance(guildId: string, ambiance: Ambiance): void {
  const session = sessions.get(guildId);
  if (session) session.ambiance = ambiance;
}

// Joue la ligne en voix (best-effort, n'echoue jamais) - a utiliser seulement apres
// joinNarratorChannel(). Si la synthese ou la lecture echoue, se resout quand meme
// pour ne jamais bloquer la progression de la partie.
export async function say(guildId: string, text: string): Promise<void> {
  const session = sessions.get(guildId);
  if (!session) {
    console.log(`[loupgarou-voice] ligne non parlee, pas de session vocale active (guilde ${guildId}) : "${text}"`);
    return;
  }
  const spoken = stripForSpeech(text);
  if (!spoken) return;
  try {
    const background = session.ambiance ? AMBIANCES[session.ambiance] : [];
    const resource = await synthesizeSpeech(spoken, undefined, background);
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
  if (!session) {
    console.log(`[loupgarou-voice] effet sonore "${effect}" ignore, pas de session vocale active (guilde ${guildId})`);
    return;
  }
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
