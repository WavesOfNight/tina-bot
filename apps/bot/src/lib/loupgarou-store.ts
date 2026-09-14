import { ROLES, type RoleId, type RolePoolOptions } from "./loupgarou-roles.js";

export type GamePhase =
  | "LOBBY"
  | "CUPID_PICK_1"
  | "CUPID_PICK_2"
  | "NIGHT_WOLF_VOTE"
  | "NIGHT_VOYANTE"
  | "NIGHT_SORCIERE"
  | "NIGHT_RESULTS"
  | "DAY_VOTE"
  | "DAY_RESULTS"
  | "ENDED";

export interface PlayerState {
  userId: string;
  role: RoleId;
  alive: boolean;
}

export interface WitchState {
  lifePotionUsed: boolean;
  deathPotionUsed: boolean;
}

export interface LoupGarouGame {
  guildId: string;
  hostId: string;
  channelId: string;
  categoryId: string | null;
  villageVoiceId: string | null;
  wolvesTextId: string | null;
  lobbyPlayerIds: Set<string>;
  minPlayers: number;
  players: Map<string, PlayerState>;
  roleOptions: RolePoolOptions;
  phase: GamePhase;
  nightNumber: number;
  cupidFirstPick: string | null;
  lovers: [string, string] | null;
  witch: WitchState;
  wolfVotes: Map<string, string>;
  villageVotes: Map<string, string>;
  pendingNightVictim: string | null;
  nightDeaths: string[];
  // Salon vocal de chaque joueur avant le debut de la partie (null si absent de tout
  // salon vocal) - permet de les y remettre individuellement a la fin.
  originalVoiceChannels: Map<string, string | null>;
  // Salon texte prive (un par joueur, cree a la demande) utilise pour les prompts
  // d'action de nuit des roles solo (Voyante, Sorciere, Cupidon, Chasseur) a la place des
  // MP - voir loupgarou-channels.ts.
  privateTextChannels: Map<string, string>;
  activeTimeouts: NodeJS.Timeout[];
  lobbyMessageId: string | null;
  // Suite a executer une fois le tir de vengeance du Chasseur resolu (ou saute) -
  // differente selon que la mort du Chasseur vient de la nuit ou du vote du village.
  pendingChasseurCallback: (() => Promise<void> | void) | null;
}

export const games = new Map<string, LoupGarouGame>();

export function createGame(
  guildId: string,
  hostId: string,
  channelId: string,
  roleOptions: RolePoolOptions,
  minPlayers: number,
): LoupGarouGame {
  const game: LoupGarouGame = {
    guildId,
    hostId,
    channelId,
    categoryId: null,
    villageVoiceId: null,
    wolvesTextId: null,
    lobbyPlayerIds: new Set(),
    minPlayers,
    players: new Map(),
    roleOptions,
    phase: "LOBBY",
    nightNumber: 0,
    cupidFirstPick: null,
    lovers: null,
    witch: { lifePotionUsed: false, deathPotionUsed: false },
    wolfVotes: new Map(),
    villageVotes: new Map(),
    pendingNightVictim: null,
    nightDeaths: [],
    originalVoiceChannels: new Map(),
    privateTextChannels: new Map(),
    activeTimeouts: [],
    lobbyMessageId: null,
    pendingChasseurCallback: null,
  };
  games.set(guildId, game);
  return game;
}

export function clearGameTimeouts(game: LoupGarouGame): void {
  for (const timeout of game.activeTimeouts) clearTimeout(timeout);
  game.activeTimeouts = [];
}

export function endGame(guildId: string): void {
  const game = games.get(guildId);
  if (game) clearGameTimeouts(game);
  games.delete(guildId);
}

export function alivePlayers(game: LoupGarouGame): PlayerState[] {
  return [...game.players.values()].filter((p) => p.alive);
}

export function aliveWolves(game: LoupGarouGame): PlayerState[] {
  return alivePlayers(game).filter((p) => ROLES[p.role].team === "LOUPS");
}

export function aliveVillage(game: LoupGarouGame): PlayerState[] {
  return alivePlayers(game).filter((p) => ROLES[p.role].team === "VILLAGE");
}

export function getPlayer(game: LoupGarouGame, userId: string): PlayerState | null {
  return game.players.get(userId) ?? null;
}

export function isAlive(game: LoupGarouGame, userId: string): boolean {
  return game.players.get(userId)?.alive ?? false;
}

export function findByRole(game: LoupGarouGame, role: RoleId): PlayerState | null {
  return alivePlayers(game).find((p) => p.role === role) ?? null;
}

export function loverOf(game: LoupGarouGame, userId: string): string | null {
  if (!game.lovers) return null;
  const [a, b] = game.lovers;
  if (a === userId) return b;
  if (b === userId) return a;
  return null;
}

// Tue les joueurs vises et propage automatiquement les cascades "amoureux" (mort de
// chagrin). Renvoie la liste complete des joueurs morts (y compris les cascades).
// Pure logique d'etat - ne declenche pas le pouvoir du Chasseur, gere separement car
// il necessite une interaction utilisateur.
export function applyDeaths(game: LoupGarouGame, targets: string[]): string[] {
  const newlyDead: string[] = [];
  const queue = [...targets];
  while (queue.length > 0) {
    const userId = queue.shift()!;
    const player = game.players.get(userId);
    if (!player || !player.alive) continue;
    player.alive = false;
    newlyDead.push(userId);
    const lover = loverOf(game, userId);
    if (lover && isAlive(game, lover)) queue.push(lover);
  }
  return newlyDead;
}

// Renvoie la liste des cibles a egalite de votes (1 seul element si majorite claire,
// plusieurs si egalite, tableau vide si personne n'a vote). Le choix entre les cibles
// a egalite (aleatoire pour les loups, "personne n'est elimine" pour le village) est
// laisse a l'appelant car la regle differe entre les deux votes.
export function tallyVotes(votes: Map<string, string>): string[] {
  if (votes.size === 0) return [];
  const counts = new Map<string, number>();
  for (const target of votes.values()) counts.set(target, (counts.get(target) ?? 0) + 1);
  const max = Math.max(...counts.values());
  return [...counts.entries()].filter(([, count]) => count === max).map(([id]) => id);
}

export type Winner = "VILLAGE" | "LOUPS" | null;

export function checkWinner(game: LoupGarouGame): Winner {
  const wolves = aliveWolves(game).length;
  const village = aliveVillage(game).length;
  if (wolves === 0) return "VILLAGE";
  if (wolves >= village) return "LOUPS";
  return null;
}

// Joueurs fictifs pour /loupgarou admintest - jamais un vrai ID Discord (les snowflakes
// sont numeriques) donc aucune collision possible. Ils ne peuvent recevoir ni MP ni etre
// deplaces en vocal ; toute action qui leur revient est auto-resolue par le moteur plutot
// que d'attendre un clic qui ne viendra jamais.
const FAKE_PLAYER_PREFIX = "fake-";

export function isFakePlayer(userId: string): boolean {
  return userId.startsWith(FAKE_PLAYER_PREFIX);
}

export function createFakePlayerIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${FAKE_PLAYER_PREFIX}${i + 1}`);
}

export function fakePlayerLabel(userId: string): string {
  return `Faux joueur ${userId.slice(FAKE_PLAYER_PREFIX.length)}`;
}
