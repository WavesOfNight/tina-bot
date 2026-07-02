import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { logCase } from "../../lib/moderation.js";
import { parseDuration } from "../../lib/duration.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannit un membre du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) => opt.setName("membre").setDescription("Le membre a bannir").setRequired(true))
    .addStringOption((opt) => opt.setName("raison").setDescription("Raison du bannissement"))
    .addStringOption((opt) =>
      opt.setName("duree").setDescription("Duree du ban (ex: 7d, 12h) - laisse vide pour un ban definitif"),
    )
    .addIntegerOption((opt) =>
      opt.setName("jours_messages").setDescription("Jours de messages a supprimer (0-7)").setMinValue(0).setMaxValue(7),
    ),
  async execute(interaction) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser("membre", true);
    const reason = interaction.options.getString("raison");
    const durationInput = interaction.options.getString("duree");
    const deleteDays = interaction.options.getInteger("jours_messages") ?? 0;

    let durationMs: number | null = null;
    if (durationInput) {
      durationMs = parseDuration(durationInput);
      if (!durationMs) {
        await interaction.reply({ content: "Duree invalide. Exemple : 7d, 12h.", ephemeral: true });
        return;
      }
    }

    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (targetMember && !targetMember.bannable) {
      await interaction.reply({ content: "Je ne peux pas bannir ce membre (role trop eleve).", ephemeral: true });
      return;
    }

    await interaction.guild.members.ban(target.id, {
      reason: reason ?? undefined,
      deleteMessageSeconds: deleteDays * 86400,
    });

    await logCase({
      guild: interaction.guild,
      userId: target.id,
      moderatorId: interaction.user.id,
      type: "BAN",
      reason,
      expiresAt: durationMs ? new Date(Date.now() + durationMs) : null,
    });

    const durationText = durationMs ? ` pour ${durationInput}` : "";
    await interaction.reply(`${target.tag} a ete banni${durationText}. ${reason ? `Raison : ${reason}` : ""}`);
  },
};

export default command;
