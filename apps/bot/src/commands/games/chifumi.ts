import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type TextChannel } from "discord.js";
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { chifumiDuels } from "../../lib/chifumi-store.js";
import { createMatch } from "../../lib/match-store.js";

export async function startChifumiRound(channel: TextChannel, players: [string, string], guildId: string, matchId?: string, roundLabel = "") {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("chifumi:open:pending").setLabel("Faire ton choix").setEmoji("🤜").setStyle(ButtonStyle.Primary),
  );

  const message = await channel.send({
    content: `<@${players[0]}> contre <@${players[1]}> a pierre-feuille-ciseaux${roundLabel} ! Cliquez pour faire votre choix (en prive).`,
    components: [row],
  });

  chifumiDuels.set(message.id, { players, choices: {}, guildId, channelId: channel.id, messageId: message.id, matchId });
  row.components[0].setCustomId(`chifumi:open:${message.id}`);
  await message.edit({ components: [row] }).catch(() => null);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("chifumi")
    .setDescription("Defie quelqu'un a pierre-feuille-ciseaux")
    .addUserOption((opt) => opt.setName("adversaire").setDescription("Ton adversaire").setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName("manches")
        .setDescription("Nombre de manches (defaut : 1)")
        .addChoices({ name: "1 manche", value: 1 }, { name: "Best of 3", value: 3 }, { name: "Best of 5", value: 5 }),
    ),
  async execute(interaction) {
    const opponent = interaction.options.getUser("adversaire", true);
    const bestOf = interaction.options.getInteger("manches") ?? 1;

    if (opponent.bot) {
      await interaction.reply({ content: "Tu ne peux pas defier un bot.", ephemeral: true });
      return;
    }
    if (opponent.id === interaction.user.id) {
      await interaction.reply({ content: "Il te faut un adversaire different de toi-meme.", ephemeral: true });
      return;
    }

    const players: [string, string] = [interaction.user.id, opponent.id];
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("chifumi:open:pending").setLabel("Faire ton choix").setEmoji("🤜").setStyle(ButtonStyle.Primary),
    );

    const matchSuffix = bestOf > 1 ? ` (manche 1/${bestOf})` : "";
    const reply = await interaction.reply({
      content: `${interaction.user} defie ${opponent} a pierre-feuille-ciseaux${matchSuffix} ! Cliquez pour faire votre choix (en prive).`,
      components: [row],
      fetchReply: true,
    });

    const duelId = reply.id;
    const match =
      bestOf > 1
        ? createMatch({ matchId: duelId, game: "CHIFUMI", players, bestOf, guildId: interaction.guildId!, channelId: interaction.channelId })
        : null;

    chifumiDuels.set(duelId, {
      players,
      choices: {},
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      messageId: reply.id,
      matchId: match?.matchId,
    });

    row.components[0].setCustomId(`chifumi:open:${duelId}`);
    await interaction.editReply({ components: [row] });
  },
};

export default command;
