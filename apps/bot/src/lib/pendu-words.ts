interface PenduWord {
  word: string;
  category: string;
}

export const PENDU_WORDS: PenduWord[] = [
  { word: "ORDINATEUR", category: "Technologie" },
  { word: "CLAVIER", category: "Technologie" },
  { word: "TELEPHONE", category: "Technologie" },
  { word: "GIRAFE", category: "Animaux" },
  { word: "ELEPHANT", category: "Animaux" },
  { word: "CROCODILE", category: "Animaux" },
  { word: "PAPILLON", category: "Animaux" },
  { word: "KANGOUROU", category: "Animaux" },
  { word: "BOULANGERIE", category: "Lieux" },
  { word: "BIBLIOTHEQUE", category: "Lieux" },
  { word: "AEROPORT", category: "Lieux" },
  { word: "MONTAGNE", category: "Nature" },
  { word: "TORNADE", category: "Nature" },
  { word: "VOLCAN", category: "Nature" },
  { word: "CASCADE", category: "Nature" },
  { word: "CROISSANT", category: "Nourriture" },
  { word: "BAGUETTE", category: "Nourriture" },
  { word: "FROMAGE", category: "Nourriture" },
  { word: "CHOCOLAT", category: "Nourriture" },
  { word: "RATATOUILLE", category: "Nourriture" },
  { word: "POMPIER", category: "Metiers" },
  { word: "BOULANGER", category: "Metiers" },
  { word: "ASTRONAUTE", category: "Metiers" },
  { word: "MUSICIEN", category: "Metiers" },
  { word: "STREAMEUR", category: "Metiers" },
  { word: "GUITARE", category: "Musique" },
  { word: "MICROPHONE", category: "Musique" },
  { word: "BATTERIE", category: "Musique" },
  { word: "DISCORD", category: "Internet" },
  { word: "STREAMING", category: "Internet" },
  { word: "MANETTE", category: "Jeux video" },
  { word: "CONSOLE", category: "Jeux video" },
  { word: "AVENTURE", category: "Jeux video" },
  { word: "CHEVALIER", category: "Fantastique" },
  { word: "DRAGON", category: "Fantastique" },
  { word: "SORCIERE", category: "Fantastique" },
  { word: "CHATEAU", category: "Fantastique" },
  { word: "PARAPLUIE", category: "Objets" },
  { word: "LUNETTES", category: "Objets" },
  { word: "BICYCLETTE", category: "Objets" },
  { word: "FRANCE", category: "Pays" },
  { word: "JAPON", category: "Pays" },
  { word: "BRESIL", category: "Pays" },
  { word: "CANADA", category: "Pays" },
];

export function pickPenduWord(): PenduWord {
  return PENDU_WORDS[Math.floor(Math.random() * PENDU_WORDS.length)];
}
