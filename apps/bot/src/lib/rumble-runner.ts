import type { TextChannel } from "discord.js";
import { prisma } from "@tina/database";
import { pickDeathMessage, rumbleGames } from "./rumble-store.js";

const TICK_MS = 5_000;

export async function runRumble(channel: TextChannel, gameId: string) {
  const interval = setInterval(async () => {
    const game = rumbleGames.get(gameId);
    if (!game) {
      clearInterval(interval);
      return;
    }

    if (game.players.length <= 1) {
      clearInterval(interval);
      rumbleGames.delete(gameId);

      if (game.players.length === 1) {
        const winnerId = game.players[0];
        await prisma.guild.upsert({ where: { id: game.guildId }, create: { id: game.guildId }, update: {} });
        await prisma.gameStat.upsert({
          where: { guildId_userId_game: { guildId: game.guildId, userId: winnerId, game: "RUMBLE" } },
          create: { guildId: game.guildId, userId: winnerId, game: "RUMBLE", plays: 1, wins: 1 },
          update: { plays: { increment: 1 }, wins: { increment: 1 } },
        });
        await channel.send(`🏆 **<@${winnerId}> remporte le combat !** GG a tous les participants.`).catch(() => null);
      } else {
        await channel.send("Le combat se termine sans survivant... personne ne gagne cette fois.").catch(() => null);
      }
      return;
    }

    const eliminationCount = Math.min(Math.floor(Math.random() * 3) + 1, game.players.length - 1);
    for (let i = 0; i < eliminationCount; i++) {
      if (game.players.length <= 1) break;
      const victimIndex = Math.floor(Math.random() * game.players.length);
      const victimId = game.players.splice(victimIndex, 1)[0];
      const { message, involvesTwo } = pickDeathMessage();

      let text: string;
      if (involvesTwo && game.players.length > 0) {
        const attackerId = game.players[Math.floor(Math.random() * game.players.length)];
        text = message.replaceAll("{a}", `<@${attackerId}>`).replaceAll("{b}", `<@${victimId}>`);
      } else {
        text = message.replaceAll("{v}", `<@${victimId}>`);
      }

      await channel
        .send(
          `⚔️ ${text} (${game.players.length} joueur${game.players.length > 1 ? "s" : ""} restant${game.players.length > 1 ? "s" : ""})`,
        )
        .catch(() => null);
    }
  }, TICK_MS);
}
