import { SlashCommandBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";

function drawNumbers(count: number, max: number): number[] {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  const drawn: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    drawn.push(pool.splice(idx, 1)[0]);
  }
  return drawn.sort((a, b) => a - b);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("loto")
    .setDescription("Joue au loto : choisis 3 numeros entre 1 et 49")
    .addIntegerOption((opt) => opt.setName("numero1").setDescription("Premier numero (1-49)").setRequired(true).setMinValue(1).setMaxValue(49))
    .addIntegerOption((opt) => opt.setName("numero2").setDescription("Deuxieme numero (1-49)").setRequired(true).setMinValue(1).setMaxValue(49))
    .addIntegerOption((opt) => opt.setName("numero3").setDescription("Troisieme numero (1-49)").setRequired(true).setMinValue(1).setMaxValue(49)),
  async execute(interaction) {
    const picks = [
      interaction.options.getInteger("numero1", true),
      interaction.options.getInteger("numero2", true),
      interaction.options.getInteger("numero3", true),
    ];

    if (new Set(picks).size !== 3) {
      await interaction.reply({ content: "Choisis 3 numeros differents.", ephemeral: true });
      return;
    }

    const drawn = drawNumbers(3, 49);
    const matches = picks.filter((n) => drawn.includes(n)).length;

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
    await prisma.gameStat.upsert({
      where: { guildId_userId_game: { guildId, userId, game: "LOTO" } },
      create: { guildId, userId, game: "LOTO", plays: 1, wins: matches === 3 ? 1 : 0 },
      update: { plays: { increment: 1 }, wins: matches === 3 ? { increment: 1 } : undefined },
    });

    const resultLine =
      matches === 3
        ? "JACKPOT ! Tu as trouve les 3 numeros !"
        : matches === 2
          ? "Pas mal, 2 numeros sur 3 !"
          : matches === 1
            ? "Un seul numero trouve, tente ta chance a nouveau !"
            : "Aucun numero trouve, la chance n'etait pas au rendez-vous.";

    await interaction.reply(
      `Tes numeros : **${picks.join(", ")}**\nTirage : **${drawn.join(", ")}**\n${resultLine}`,
    );
  },
};

export default command;
