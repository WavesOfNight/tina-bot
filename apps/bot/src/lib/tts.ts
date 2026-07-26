import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { StreamType, createAudioResource, type AudioResource } from "@discordjs/voice";
import prismMedia from "prism-media";

const { FFmpeg } = prismMedia;

// Voix neutre/neutre-grave gratuite (Microsoft Edge, aucune cle API requise). Le vrai
// clonage de voix (RVC) demanderait un serveur GPU pour tourner en temps reel, absent
// du VPS de production - cette voix neurale est le meilleur compromis realiste.
export const NARRATOR_VOICE = "fr-FR-HenriNeural";

function escapeSsmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function synthesizeSpeech(text: string, voice: string = NARRATOR_VOICE): Promise<AudioResource> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(escapeSsmlText(text));

  const close = () => tts.close();
  audioStream.once("end", close);
  audioStream.once("error", (error) => {
    console.error("Erreur du flux TTS", error);
    close();
  });

  const ffmpeg = new FFmpeg({
    args: ["-i", "pipe:0", "-analyzeduration", "0", "-loglevel", "warning", "-f", "s16le", "-ar", "48000", "-ac", "2"],
  });
  (ffmpeg as any).process?.stderr?.on("data", (chunk: Buffer) => {
    console.error(`[loupgarou-tts-ffmpeg] ${chunk.toString().trim()}`);
  });
  audioStream.pipe(ffmpeg);

  return createAudioResource(ffmpeg, { inputType: StreamType.Raw });
}
