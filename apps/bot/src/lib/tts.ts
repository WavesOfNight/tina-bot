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

// Volume de la musique/ambiance d'arriere-plan quand elle est melangee sous une ligne
// parlee - assez bas pour ne jamais couvrir la voix ("pas trop fort").
const AMBIANCE_VOLUME = 0.18;

export async function synthesizeSpeech(text: string, voice: string = NARRATOR_VOICE, ambiancePath?: string): Promise<AudioResource> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(escapeSsmlText(text));

  const close = () => tts.close();
  audioStream.once("end", close);
  audioStream.once("error", (error) => {
    console.error("Erreur du flux TTS", error);
    close();
  });

  // Sans ambiance : la voix seule. Avec ambiance : un second input (le fichier
  // d'ambiance, boucle au besoin) melange sous la voix via amix, coupe automatiquement a
  // la duree de la voix (duration=first) puisqu'on ne connait pas sa longueur a l'avance.
  const args = ambiancePath
    ? [
        "-i",
        "pipe:0",
        "-stream_loop",
        "-1",
        "-i",
        ambiancePath,
        "-filter_complex",
        `[1:a]volume=${AMBIANCE_VOLUME}[amb];[0:a][amb]amix=inputs=2:duration=first:dropout_transition=0`,
        "-analyzeduration",
        "0",
        "-loglevel",
        "warning",
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
      ]
    : ["-i", "pipe:0", "-analyzeduration", "0", "-loglevel", "warning", "-f", "s16le", "-ar", "48000", "-ac", "2"];

  const ffmpeg = new FFmpeg({ args });
  (ffmpeg as any).process?.stderr?.on("data", (chunk: Buffer) => {
    console.error(`[loupgarou-tts-ffmpeg] ${chunk.toString().trim()}`);
  });
  audioStream.pipe(ffmpeg);

  return createAudioResource(ffmpeg, { inputType: StreamType.Raw });
}
