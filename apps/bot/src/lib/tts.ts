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
// une ligne parlee OU un effet sonore - plus basse que quand elle joue seule (voir
// AMBIANCE_LOOP_VOLUME) pour que la voix/l'effet reste bien audible par-dessus, mais pas
// trop en retrait non plus. Exportee pour que playSoundEffect (loupgarou-voice.ts)
// applique exactement la meme reduction que say(), pour un volume coherent entre les deux.
export const BACKGROUND_VOLUME = 0.3;

// Chaque ligne parlee (et chaque reprise de la boucle entre les lignes, voir
// createLoopingAudioResource ci-dessous) demarre un nouveau process ffmpeg pour le fond
// sonore - sans ce fondu, le changement de volume est un "clic" audible a chaque
// reprise. 600ms suffit a lisser la transition sans la rendre perceptible comme un delai.
export const BACKGROUND_FADE_IN_SECONDS = 0.6;

export async function synthesizeSpeech(
  text: string,
  voice: string = NARRATOR_VOICE,
  backgroundPath?: string,
  backgroundOffsetSeconds = 0,
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

  // Sans fond sonore : la voix seule. Avec fond sonore : un second input (boucle au
  // besoin) melange sous la voix via amix, coupe automatiquement a la duree de la voix
  // (duration=first) puisqu'on ne connait pas sa longueur a l'avance. Un seul input
  // supplementaire (deliberement) - un graphe de filtres a 3 entrees (voix + 2 fonds
  // sonores separes) s'est avere peu fiable en production, d'ou le pre-melange en amont.
  // -ss reprend le fond a l'endroit ou il en etait (voir loupgarou-voice.ts) plutot que
  // de repartir du debut du fichier a chaque replique, et afade lisse la reprise.
  const args = backgroundPath
    ? [
        "-i",
        "pipe:0",
        "-ss",
        String(backgroundOffsetSeconds),
        "-stream_loop",
        "-1",
        "-i",
        backgroundPath,
        "-filter_complex",
        `[1:a]afade=t=in:st=0:d=${BACKGROUND_FADE_IN_SECONDS},volume=${BACKGROUND_VOLUME}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0`,
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
// offsetSeconds reprend la piste a l'endroit ou elle en etait plutot que de repartir du
// debut a chaque reprise (voir currentAmbianceOffset dans loupgarou-voice.ts), et le
// fondu d'entree lisse le "clic" que produirait sinon un changement de volume brutal.
export function createLoopingAudioResource(path: string, volume: number, offsetSeconds = 0): AudioResource {
  const ffmpeg = new FFmpeg({
    args: [
      "-ss",
      String(offsetSeconds),
      "-stream_loop",
      "-1",
      "-i",
      path,
      "-filter:a",
      `afade=t=in:st=0:d=${BACKGROUND_FADE_IN_SECONDS},volume=${volume}`,
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

// Empile un effet sonore ponctuel (coq, couteau, etc.) PAR-DESSUS la musique de fond en
// cours plutot que de l'interrompre - meme principe et memes reglages (position suivie,
// fondu d'entree) que synthesizeSpeech avec fond sonore, juste entre deux fichiers
// statiques au lieu d'un pipe TTS. Se termine avec l'effet (duration=first), la boucle
// seule reprend juste apres (voir resumeAmbianceLoop dans loupgarou-voice.ts).
export function createSfxOverMusicResource(
  sfxPath: string,
  sfxVolume: number,
  musicPath: string,
  musicOffsetSeconds: number,
): AudioResource {
  const ffmpeg = new FFmpeg({
    args: [
      "-i",
      sfxPath,
      "-ss",
      String(musicOffsetSeconds),
      "-stream_loop",
      "-1",
      "-i",
      musicPath,
      "-filter_complex",
      `[0:a]volume=${sfxVolume}[fg];[1:a]afade=t=in:st=0:d=${BACKGROUND_FADE_IN_SECONDS},volume=${BACKGROUND_VOLUME}[bg];[fg][bg]amix=inputs=2:duration=first:dropout_transition=0`,
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
    console.error(`[loupgarou-sfx-ffmpeg] ${chunk.toString().trim()}`);
  });
  return createAudioResource(ffmpeg, { inputType: StreamType.Raw });
}
