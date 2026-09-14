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

export interface BackgroundLayer {
  path: string;
  // Assez bas pour ne jamais couvrir la voix ("ni trop fort ni trop bas") - plusieurs
  // couches (ambiance + musique) s'additionnent, donc chacune reste discrete.
  volume: number;
}

export async function synthesizeSpeech(
  text: string,
  voice: string = NARRATOR_VOICE,
  background: BackgroundLayer[] = [],
): Promise<AudioResource> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(escapeSsmlText(text));

  const close = () => tts.close();
  audioStream.once("end", close);
  audioStream.once("error", (error) => {
    console.error("Erreur du flux TTS", error);
    close();
  });

  // Sans couche de fond : la voix seule. Avec une ou plusieurs couches (ambiance,
  // musique...) : chacune est un input supplementaire boucle au besoin, melange sous la
  // voix via amix, coupe automatiquement a la duree de la voix (duration=first)
  // puisqu'on ne connait pas sa longueur a l'avance.
  let args: string[];
  if (background.length === 0) {
    args = ["-i", "pipe:0", "-analyzeduration", "0", "-loglevel", "warning", "-f", "s16le", "-ar", "48000", "-ac", "2"];
  } else {
    const inputArgs = background.flatMap((layer) => ["-stream_loop", "-1", "-i", layer.path]);
    const volumeLabels = background.map((layer, i) => `[${i + 1}:a]volume=${layer.volume}[bg${i}]`).join(";");
    const mixInputs = ["[0:a]", ...background.map((_, i) => `[bg${i}]`)].join("");
    const filterComplex = `${volumeLabels};${mixInputs}amix=inputs=${background.length + 1}:duration=first:dropout_transition=0`;
    args = [
      "-i",
      "pipe:0",
      ...inputArgs,
      "-filter_complex",
      filterComplex,
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
    ];
  }

  const ffmpeg = new FFmpeg({ args });
  (ffmpeg as any).process?.stderr?.on("data", (chunk: Buffer) => {
    console.error(`[loupgarou-tts-ffmpeg] ${chunk.toString().trim()}`);
  });
  audioStream.pipe(ffmpeg);

  return createAudioResource(ffmpeg, { inputType: StreamType.Raw });
}
