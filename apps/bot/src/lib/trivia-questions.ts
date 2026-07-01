export interface TriviaQuestion {
  question: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  category: string;
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { question: "Quelle est la capitale du Japon ?", choices: ["Osaka", "Tokyo", "Kyoto", "Nagoya"], correctIndex: 1, category: "Culture generale" },
  { question: "Combien de continents y a-t-il sur Terre ?", choices: ["5", "6", "7", "8"], correctIndex: 2, category: "Culture generale" },
  { question: "Qui a peint la Joconde ?", choices: ["Michel-Ange", "Leonard de Vinci", "Raphael", "Donatello"], correctIndex: 1, category: "Culture generale" },
  { question: "Quel est le plus grand ocean du monde ?", choices: ["Atlantique", "Indien", "Arctique", "Pacifique"], correctIndex: 3, category: "Culture generale" },
  { question: "En quelle annee a eu lieu la Revolution francaise ?", choices: ["1789", "1799", "1804", "1815"], correctIndex: 0, category: "Culture generale" },
  { question: "Quel est le plus long fleuve du monde ?", choices: ["Amazone", "Nil", "Yangtse", "Mississippi"], correctIndex: 1, category: "Culture generale" },
  { question: "Combien y a-t-il de joueurs dans une equipe de football sur le terrain ?", choices: ["9", "10", "11", "12"], correctIndex: 2, category: "Culture generale" },
  { question: "Quelle planete est surnommee la planete rouge ?", choices: ["Venus", "Jupiter", "Mars", "Saturne"], correctIndex: 2, category: "Culture generale" },
  { question: "Dans quel jeu affronte-t-on des Pokemon dans une Ligue ?", choices: ["Pokemon Rouge", "Pokemon Snap", "Pokemon Rumble", "Pokken"], correctIndex: 0, category: "Gaming" },
  { question: "Quelle entreprise a cree Minecraft ?", choices: ["Valve", "Mojang", "Epic Games", "Ubisoft"], correctIndex: 1, category: "Gaming" },
  { question: "Dans League of Legends, comment appelle-t-on la base a proteger ?", choices: ["Le Fort", "Le Nexus", "La Base", "Le Cristal"], correctIndex: 1, category: "Gaming" },
  { question: "Quel est le personnage principal de la saga Zelda ?", choices: ["Zelda", "Link", "Ganon", "Epona"], correctIndex: 1, category: "Gaming" },
  { question: "Dans quel jeu trouve-t-on des 'Creepers' ?", choices: ["Terraria", "Minecraft", "Roblox", "Fortnite"], correctIndex: 1, category: "Gaming" },
  { question: "Quel studio a developpe The Witcher 3 ?", choices: ["CD Projekt Red", "Bethesda", "FromSoftware", "Bioware"], correctIndex: 0, category: "Gaming" },
  { question: "Combien de coeurs Link a-t-il au debut de Breath of the Wild ?", choices: ["1", "3", "5", "10"], correctIndex: 1, category: "Gaming" },
  { question: "Dans quel anime trouve-t-on les 'Titans' ?", choices: ["Naruto", "L'Attaque des Titans", "One Piece", "Bleach"], correctIndex: 1, category: "Anime" },
  { question: "Quel est le reve de Monkey D. Luffy dans One Piece ?", choices: ["Devenir Hokage", "Devenir le Roi des Pirates", "Battre Naruto", "Sauver le monde"], correctIndex: 1, category: "Anime" },
  { question: "Comment s'appelle le cahier surnaturel dans Death Note ?", choices: ["Le Grimoire", "Le Death Note", "Le Livre Noir", "Le Registre"], correctIndex: 1, category: "Anime" },
  { question: "Dans Naruto, quel village Naruto protege-t-il ?", choices: ["Konoha", "Suna", "Kiri", "Iwa"], correctIndex: 0, category: "Anime" },
  { question: "Qui est le rival principal de Naruto ?", choices: ["Kakashi", "Gaara", "Sasuke", "Rock Lee"], correctIndex: 2, category: "Anime" },
  { question: "Dans My Hero Academia, comment appelle-t-on les pouvoirs ?", choices: ["Quirks", "Nen", "Chakra", "Stands"], correctIndex: 0, category: "Anime" },
  { question: "Combien de dragons faut-il reunir dans Dragon Ball ?", choices: ["5", "6", "7", "9"], correctIndex: 2, category: "Anime" },
];
