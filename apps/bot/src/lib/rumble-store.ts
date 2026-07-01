export interface RumbleGame {
  guildId: string;
  channelId: string;
  messageId: string;
  hostId: string;
  players: string[];
  phase: "registration" | "running" | "finished";
}

export const rumbleGames = new Map<string, RumbleGame>();
export const MAX_RUMBLE_PLAYERS = 30;

const DUO_EVENTS = [
  "{a} a glisse sur une peau de banane lancee par {b} et s'est brise le cou.",
  "{a} a piege {b} sous un piano tombe du ciel.",
  "{a} a pousse {b} dans une fosse a lave, sans regret.",
  "{a} a lance une enclume sur {b} depuis une falaise.",
  "{a} a echange sa nourriture avec {b}... qui etait empoisonnee.",
  "{a} a vaincu {b} dans un combat de regards. {b} n'a pas survecu a la honte.",
  "{a} a saborde le radeau de {b} au milieu de la riviere.",
  "{a} a convaincu {b} de gouter un champignon sauvage. Mauvaise idee.",
  "{a} a tire une fleche perdue qui a atteint {b} en plein dos.",
  "{a} a enferme {b} dans un coffre et a jete la cle.",
];

const SOLO_EVENTS = [
  "{v} a marche sur un rateau et n'a pas survecu a la honte.",
  "{v} a essaye de caresser un ours sauvage. Grave erreur.",
  "{v} s'est noye en essayant de traverser une riviere en courant.",
  "{v} a mange une baie inconnue et n'a pas survecu.",
  "{v} est tombe dans un puits en cherchant un signal reseau.",
  "{v} a active un piege qu'iel avait pose la veille.",
  "{v} s'est endormi sur les rails d'un train miniature abandonne.",
  "{v} a glisse en dansant la macarena et s'est empale sur un cactus.",
];

export function pickDeathMessage(): { message: string; involvesTwo: boolean } {
  if (Math.random() < 0.6) {
    const template = DUO_EVENTS[Math.floor(Math.random() * DUO_EVENTS.length)];
    return { message: template, involvesTwo: true };
  }
  const template = SOLO_EVENTS[Math.floor(Math.random() * SOLO_EVENTS.length)];
  return { message: template, involvesTwo: false };
}
