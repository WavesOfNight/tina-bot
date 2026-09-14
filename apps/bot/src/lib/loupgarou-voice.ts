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
import { synthesizeSpeech, createLoopingAudioResource, createSfxOverMusicResource } from "./tts.js";

// Sources (toutes CC0 sauf mention contraire) : knife-blade-3, cock-song-1, archery,
// water-bubble-2 (BigSoundBank), chimes-dream-8 (LaSonotheque, meme licence CC0). Cupidon
// reutilise le meme bruit d'arc que le Chasseur (l'image classique de la fleche de
// Cupidon), joue deux fois - une par amoureux designe. Pas de signal sonore pour le debut
// de la nuit elle-meme (retire) - la musique d'ambiance suffit a marquer la transition.
const SOUND_EFFECTS = {
  dawn: fileURLToPath(new URL("../../assets/sfx/dawn-rooster.mp3", import.meta.url)),
  death: fileURLToPath(new URL("../../assets/sfx/death-knife.mp3", import.meta.url)),
  voyante: fileURLToPath(new URL("../../assets/sfx/role-voyante.mp3", import.meta.url)),
  sorciere: fileURLToPath(new URL("../../assets/sfx/role-sorciere.mp3", import.meta.url)),
  cupidon: fileURLToPath(new URL("../../assets/sfx/role-chasseur.mp3", import.meta.url)),
  chasseur: fileURLToPath(new URL("../../assets/sfx/role-chasseur.mp3", import.meta.url)),
} as const;

export type SoundEffect = keyof typeof SOUND_EFFECTS;

// Volume individuel de chaque effet (1 = volume d'origine du fichier) - les fichiers
// viennent de sources differentes et n'ont pas le meme niveau a l'origine (le coq etait
// nettement trop fort), d'ou un reglage explicite pour chacun plutot que de garder le
// volume brut de chaque fichier.
const SFX_VOLUME: Record<SoundEffect, number> = {
  dawn: 0.5,
  death: 0.7,
  voyante: 0.6,
  sorciere: 0.6,
  cupidon: 0.6,
  chasseur: 0.6,
};

// Musique de fond (fournie par l'utilisateur) melangee sous la voix pendant la nuit/le
// jour - seule la voix + la musique, sans bruit d'ambiance superpose (les bruitages
// comme le criquet ou le coq restent des effets ponctuels joues seuls via
// playSoundEffect, jamais en meme temps que la musique).
const AMBIANCES = {
  night: fileURLToPath(new URL("../../assets/music/night.mp3", import.meta.url)),
  day: fileURLToPath(new URL("../../assets/music/day.mp3", import.meta.url)),
} as const;

export type Ambiance = keyof typeof AMBIANCES | null;

// Legerement plus fort que BACKGROUND_VOLUME (tts.ts) : la musique joue seule ici, sans
// voix a couvrir - mais l'ecart reste volontairement faible pour eviter un effet de
// "pompage" (fort entre les lignes, faible pendant) trop marque.
const AMBIANCE_LOOP_VOLUME = 0.4;

// Duree des pistes day.mp3/night.mp3 fournies (rognees a 120s avec fondu integre) - sert
// a faire boucler le calcul de position (voir currentAmbianceOffset) sur la duree reelle.
// La marge de securite evite de reprendre a quelques centaines de ms de la toute fin du
// fichier, ce qui produirait un court accroc audible au moment ou -stream_loop reboucle.
const TRACK_DURATION_SECONDS = 120;
const TRACK_LOOP_SAFETY_MARGIN_SECONDS = 5;

interface NarratorSession {
  connection: VoiceConnection;
  player: AudioPlayer;
  channelId: string;
  ambiance: Ambiance;
  // Horodatage (Date.now()) du debut "virtuel" de la piste actuellement en ambiance -
  // permet de faire reprendre chaque nouveau process ffmpeg (TTS ou boucle seule) a
  // l'endroit ou la musique en est reellement, au lieu de repartir du debut du fichier a
  // chaque replique (ce qui donnait l'impression que la musique "s'eteint et se relance").
  ambianceStartedAt: number | null;
}

// Position (en secondes, repliee sur la duree du morceau) a laquelle reprendre la piste
// d'ambiance actuelle pour qu'elle semble continuer plutot que redemarrer.
function currentAmbianceOffset(session: NarratorSession): number {
  if (!session.ambianceStartedAt) return 0;
  const elapsed = (Date.now() - session.ambianceStartedAt) / 1000;
  return elapsed % (TRACK_DURATION_SECONDS - TRACK_LOOP_SAFETY_MARGIN_SECONDS);
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

  sessions.set(guildId, {
    connection,
    player,
    channelId,
    ambiance: existing?.ambiance ?? null,
    ambianceStartedAt: existing?.ambianceStartedAt ?? null,
  });
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

// Relance la musique de fond en boucle seule (sans voix) sur le player - c'est ce qui la
// fait continuer entre deux repliques ou pendant une pause au lieu de s'arreter des que
// le TTS se tait. Jouer une nouvelle resource sur le player remplace silencieusement
// celle en cours (pas d'evenement Idle emis) : cet appel n'interrompt donc jamais un
// say()/playSoundEffect() deja en train de jouer, seulement le silence qui suivrait.
function resumeAmbianceLoop(guildId: string): void {
  const session = sessions.get(guildId);
  if (!session?.ambiance) return;
  const resource = createLoopingAudioResource(AMBIANCES[session.ambiance], AMBIANCE_LOOP_VOLUME, currentAmbianceOffset(session));
  session.player.play(resource);
}

// Change l'ambiance sonore de la partie (null = aucune) et relance aussitot la musique
// correspondante en boucle. N'affecte pas les effets sonores ponctuels (playSoundEffect),
// qui l'interrompent brievement avant qu'elle ne reprenne automatiquement. Changer de
// piste (nuit <-> jour) reinitialise la position ; garder la meme piste ne la touche pas.
export function setAmbiance(guildId: string, ambiance: Ambiance): void {
  const session = sessions.get(guildId);
  if (!session) return;
  if (session.ambiance !== ambiance) session.ambianceStartedAt = ambiance ? Date.now() : null;
  session.ambiance = ambiance;
  resumeAmbianceLoop(guildId);
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
    const backgroundPath = session.ambiance ? AMBIANCES[session.ambiance] : undefined;
    const resource = await synthesizeSpeech(spoken, undefined, backgroundPath, currentAmbianceOffset(session));
    await playAndWait(session.player, resource);
  } catch (error) {
    console.error(`Echec de la synthese vocale (guilde ${guildId})`, error);
  } finally {
    // La ligne est terminee (ou a echoue) - la musique doit continuer plutot que de
    // s'arreter net avec elle.
    resumeAmbianceLoop(guildId);
  }
}

// Poste toujours le texte dans le salon (source de verite), et tente en plus la voix.
export async function narrate(guildId: string, textChannel: GuildTextBasedChannel, text: string): Promise<void> {
  await textChannel.send(text).catch(() => null);
  await say(guildId, text);
}

// Joue un petit effet sonore ponctuel (best-effort, comme say()). Si une ambiance est
// active, l'effet est empile PAR-DESSUS la musique en cours (comme la voix) plutot que de
// l'interrompre completement - la musique ne coupe jamais, meme le temps d'un effet.
export async function playSoundEffect(guildId: string, effect: SoundEffect): Promise<void> {
  const session = sessions.get(guildId);
  if (!session) {
    console.log(`[loupgarou-voice] effet sonore "${effect}" ignore, pas de session vocale active (guilde ${guildId})`);
    return;
  }
  try {
    const resource = session.ambiance
      ? createSfxOverMusicResource(SOUND_EFFECTS[effect], SFX_VOLUME[effect], AMBIANCES[session.ambiance], currentAmbianceOffset(session))
      : createAudioResource(SOUND_EFFECTS[effect], { inlineVolume: true });
    if (!session.ambiance) resource.volume?.setVolume(SFX_VOLUME[effect]);
    await playAndWait(session.player, resource);
  } catch (error) {
    console.error(`Echec de la lecture de l'effet sonore "${effect}" (guilde ${guildId})`, error);
  } finally {
    // L'effet est termine - la boucle seule (si une ambiance est active) reprend derriere.
    resumeAmbianceLoop(guildId);
  }
}

export function leaveNarratorChannel(guildId: string): void {
  const session = sessions.get(guildId);
  if (!session) return;
  sessions.delete(guildId);
  session.player.stop(true);
  session.connection.destroy();
}
