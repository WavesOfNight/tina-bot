import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type AudioPlayer,
  type VoiceConnection,
} from "@discordjs/voice";
import prismMedia from "prism-media";
import ffmpegPathImport from "ffmpeg-static";

const { FFmpeg } = prismMedia;
import type { Client } from "discord.js";
import { prisma } from "@tina/database";

const ffmpegPath = ffmpegPathImport as unknown as string | null;
if (ffmpegPath) process.env.FFMPEG_PATH = ffmpegPath;

const RADIO_URL = "https://radio.reads-records.com/listen/reads_radio/radio.mp3";
const RESTART_DELAY_MS = 3_000;

interface RadioSession {
  connection: VoiceConnection;
  player: AudioPlayer;
  channelId: string;
  reconnecting: boolean;
}

const sessions = new Map<string, RadioSession>();

function createResource() {
  const ffmpeg = new FFmpeg({
    args: [
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "5",
      "-i",
      RADIO_URL,
      "-analyzeduration",
      "0",
      "-loglevel",
      "0",
      "-f",
      "s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
    ],
  });
  return createAudioResource(ffmpeg, { inputType: StreamType.Raw });
}

function restartWithBackoff(session: RadioSession) {
  if (session.reconnecting) return;
  session.reconnecting = true;
  setTimeout(() => {
    session.reconnecting = false;
    try {
      session.player.play(createResource());
    } catch (error) {
      console.error("Echec du redemarrage du flux radio", error);
    }
  }, RESTART_DELAY_MS);
}

function stopSession(guildId: string) {
  const session = sessions.get(guildId);
  if (!session) return;
  sessions.delete(guildId);
  session.player.stop(true);
  session.connection.destroy();
}

async function startSession(client: Client, guildId: string, channelId: string): Promise<void> {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isVoiceBased()) return;

  const connection = joinVoiceChannel({
    channelId,
    guildId,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
  connection.subscribe(player);

  const session: RadioSession = { connection, player, channelId, reconnecting: false };
  sessions.set(guildId, session);

  player.on(AudioPlayerStatus.Idle, () => {
    if (sessions.get(guildId) === session) restartWithBackoff(session);
  });
  player.on("error", (error) => {
    console.error(`Erreur du lecteur radio (guilde ${guildId})`, error);
    if (sessions.get(guildId) === session) restartWithBackoff(session);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      if (sessions.get(guildId) === session) stopSession(guildId);
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch (error) {
    console.error(`Connexion vocale impossible pour la radio (guilde ${guildId})`, error);
    stopSession(guildId);
    return;
  }

  player.play(createResource());
}

export async function syncRadioPlayback(client: Client) {
  const guilds = await prisma.guild.findMany({
    where: { radioEnabled: true, radioChannelId: { not: null } },
  });
  const desired = new Map(guilds.map((g) => [g.id, g.radioChannelId as string]));

  for (const [guildId, session] of sessions) {
    const wantedChannel = desired.get(guildId);
    if (!wantedChannel || wantedChannel !== session.channelId) {
      stopSession(guildId);
    }
  }

  for (const [guildId, channelId] of desired) {
    if (!sessions.has(guildId)) {
      await startSession(client, guildId, channelId).catch((error) =>
        console.error(`Impossible de demarrer la radio pour la guilde ${guildId}`, error),
      );
    }
  }
}

export function stopAllRadioSessions() {
  for (const guildId of [...sessions.keys()]) {
    stopSession(guildId);
  }
}
