export type Team = "VILLAGE" | "LOUPS";
export type RoleId = "LOUP_GAROU" | "VILLAGEOIS" | "VOYANTE" | "SORCIERE" | "CHASSEUR" | "CUPIDON";

export interface RoleDef {
  id: RoleId;
  name: string;
  team: Team;
  description: string;
  hasNightAction: boolean;
}

export const ROLES: Record<RoleId, RoleDef> = {
  LOUP_GAROU: {
    id: "LOUP_GAROU",
    name: "Loup-Garou",
    team: "LOUPS",
    description: "Chaque nuit, vote avec les autres loups pour devorer une victime.",
    hasNightAction: true,
  },
  VILLAGEOIS: {
    id: "VILLAGEOIS",
    name: "Villageois",
    team: "VILLAGE",
    description: "Aucun pouvoir special. Survis et demasque les loups en votant le jour.",
    hasNightAction: false,
  },
  VOYANTE: {
    id: "VOYANTE",
    name: "Voyante",
    team: "VILLAGE",
    description: "Chaque nuit, tu peux sonder le role d'un joueur de ton choix.",
    hasNightAction: true,
  },
  SORCIERE: {
    id: "SORCIERE",
    name: "Sorciere",
    team: "VILLAGE",
    description:
      "Tu as une potion de vie (sauve la victime des loups) et une potion de mort (elimine qui tu veux), chacune utilisable une seule fois dans la partie.",
    hasNightAction: true,
  },
  CHASSEUR: {
    id: "CHASSEUR",
    name: "Chasseur",
    team: "VILLAGE",
    description: "A ta mort, tu tires immediatement sur un joueur de ton choix, qui meurt aussi.",
    hasNightAction: false,
  },
  CUPIDON: {
    id: "CUPIDON",
    name: "Cupidon",
    team: "VILLAGE",
    description: "La toute premiere nuit, tu designes deux amoureux. Si l'un meurt, l'autre meurt de chagrin.",
    hasNightAction: false,
  },
};

export interface RolePoolOptions {
  voyante: boolean;
  sorciere: boolean;
  chasseur: boolean;
  cupidon: boolean;
}

const WOLF_RATIO = 4;

export function computeWolfCount(playerCount: number): number {
  const raw = Math.max(1, Math.floor(playerCount / WOLF_RATIO));
  return Math.min(raw, Math.max(1, playerCount - 1));
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildRolePool(playerCount: number, options: RolePoolOptions): RoleId[] {
  const wolfCount = computeWolfCount(playerCount);
  const pool: RoleId[] = Array(wolfCount).fill("LOUP_GAROU");

  const optionalOrder: [keyof RolePoolOptions, RoleId][] = [
    ["voyante", "VOYANTE"],
    ["sorciere", "SORCIERE"],
    ["chasseur", "CHASSEUR"],
    ["cupidon", "CUPIDON"],
  ];
  for (const [flag, roleId] of optionalOrder) {
    if (options[flag] && pool.length < playerCount) pool.push(roleId);
  }
  while (pool.length < playerCount) pool.push("VILLAGEOIS");

  return pool;
}

export function assignRoles(playerIds: string[], options: RolePoolOptions): Map<string, RoleId> {
  const pool = shuffle(buildRolePool(playerIds.length, options));
  const assignment = new Map<string, RoleId>();
  playerIds.forEach((playerId, index) => assignment.set(playerId, pool[index]));
  return assignment;
}
