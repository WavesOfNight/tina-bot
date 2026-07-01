import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { prisma } from "@tina/database";
import type { ButtonHandler } from "../types.js";
import { chifumiDuels, chifumiEmoji, resolveChifumi, type ChifumiChoice } from "../lib/chifumi-store.js";

async function bumpStat(guildId: string, userId: string, field: "wins" | "losses" | "draws") {
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.gameStat.upsert({
    where: { guildId_userId_game: { guildId, userId, game: "CHIFUMI" } },
    create: { guildId, userId, game: "CHIFUMI", plays: 1, [field]: 1 },
    update: { plays: { increment: 1 }, [field]: { increment: 1 } },
  });
}

const handler: ButtonHandler = {
  prefix: "chifumi",
  async execute(interaction, parts) {
    const [action, duelId, choice] = parts;
    const duel = chifumiDuels.get(duelId);

    if (!duel) {
      await interaction.reply({ content: "Ce duel n'existe plus.", ephemeral: true });
      return;
    }
    if (!duel.players.includes(interaction.user.id)) {
      await interaction.reply({ content: "Ce duel ne t'appartient pas.", ephemeral: true });
      return;
    }

    if (action === "open") {
      if (duel.choices[interaction.user.id]) {
        await interaction.reply({ content: "Tu as deja fait ton choix, en attente de ton adversaire...", ephemeral: true });
        return;
      }
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`chifumi:pick:${duelId}:pierre`).setLabel("Pierre").setEmoji("🪨").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`chifumi:pick:${duelId}:feuille`).setLabel("Feuille").setEmoji("📄").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`chifumi:pick:${duelId}:ciseaux`).setLabel("Ciseaux").setEmoji("✂️").setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({ content: "Fais ton choix :", components: [row], ephemeral: true });
      return;
    }

    if (action === "pick") {
      duel.choices[interaction.user.id] = choice as ChifumiChoice;
      await interaction.update({ content: `Tu as choisi ${chifumiEmoji(choice as ChifumiChoice)} ! En attente de l'adversaire...`, components: [] });

      const [p1, p2] = duel.players;
      const choiceA = duel.choices[p1];
      const choiceB = duel.choices[p2];
      if (!choiceA || !choiceB) return;

      chifumiDuels.delete(duelId);
      const result = resolveChifumi(choiceA, choiceB);

      const channel = await interaction.client.channels.fetch(duel.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;
      const message = await channel.messages.fetch(duel.messageId).catch(() => null);
      if (!message) return;

      let resultLine: string;
      if (result === "draw") {
        resultLine = "Egalite !";
        await bumpStat(duel.guildId, p1, "draws");
        await bumpStat(duel.guildId, p2, "draws");
      } else {
        const winnerId = result === "a" ? p1 : p2;
        const loserId = result === "a" ? p2 : p1;
        resultLine = `<@${winnerId}> gagne !`;
        await bumpStat(duel.guildId, winnerId, "wins");
        await bumpStat(duel.guildId, loserId, "losses");
      }

      await message
        .edit(
          `<@${p1}> ${chifumiEmoji(choiceA)} contre ${chifumiEmoji(choiceB)} <@${p2}>\n${resultLine}`,
        )
        .catch(() => null);
    }
  },
};

export default handler;
