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

// Volume de la musique de fond (voir loupgarou-voice.ts) quand elle est melangee sous
// une ligne parlee - plus basse que quand elle joue seule (voir AMBIANCE_LOOP_VOLUME)
// pour que la voix reste bien audible par-dessus.
const BACKGROUND_VOLUME = 0.28;

export async function synthesizeSpeech(text: string, voice: string = NARRATOR_VOICE, backgroundPath?: string): Promise<AudioResource> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(escapeSsmlText(text));

  const close = () => tts.close();
  audioStream.once("end", close);
  audioStream.once("error", (error) => {
    console.error("Erreur du flux TTS", error);
    close();
  });

  // Sans fond sonore : la voix seule. Avec fond sonore : un second input (boucle au
  // besoin) melange sous la voix via amix, coupe automatiquement a la duree de la voix
  // (duration=first) puisqu'on ne connait pas sa longueur a l'avance. Un seul input
  // supplementaire (deliberement) - un graphe de filtres a 3 entrees (voix + 2 fonds
  // sonores separes) s'est avere peu fiable en production, d'ou le pre-melange en amont.
  const args = backgroundPath
    ? [
        "-i",
        "pipe:0",
        "-stream_loop",
        "-1",
        "-i",
        backgroundPath,
        "-filter_complex",
        `[1:a]volume=${BACKGROUND_VOLUME}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0`,
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

// Musique de fond jouee en boucle infinie, independamment de toute ligne parlee - c'est
// ce qui permet a l'ambiance de continuer sans interruption entre deux repliques (ou
// pendant une pause) au lieu de couper des que le TTS s'arrete. Interrompue simplement en
// jouant une autre resource sur le meme player (voir loupgarou-voice.ts).
export function createLoopingAudioResource(path: string, volume: number): AudioResource {
  const ffmpeg = new FFmpeg({
    args: [
      "-stream_loop",
      "-1",
      "-i",
      path,
      "-filter:a",
      `volume=${volume}`,
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
    ],
  });
  (ffmpeg as any).process?.stderr?.on("data", (chunk: Buffer) => {
    console.error(`[loupgarou-ambiance-ffmpeg] ${chunk.toString().trim()}`);
  });
  return createAudioResource(ffmpeg, { inputType: StreamType.Raw });
}
