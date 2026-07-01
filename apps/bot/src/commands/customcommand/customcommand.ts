import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "@tina/database";
import type { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("customcommand")
    .setDescription("Gere les commandes personnalisees du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Ajoute une commande personnalisee")
        .addStringOption((opt) => opt.setName("nom").setDescription("Nom de la commande (sans prefixe)").setRequired(true))
        .addStringOption((opt) => opt.setName("reponse").setDescription("Reponse du bot").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Supprime une commande personnalisee")
        .addStringOption((opt) => opt.setName("nom").setDescription("Nom de la commande").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("Liste les commandes personnalisees")),
  async execute(interaction) {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });

    if (sub === "add") {
      const name = interaction.options.getString("nom", true).toLowerCase().replace(/\s+/g, "-");
      const response = interaction.options.getString("reponse", true);

      await prisma.customCommand.upsert({
        where: { guildId_name: { guildId, name } },
        create: { guildId, name, response },
        update: { response },
      });

      await interaction.reply(`Commande personnalisee \`${name}\` enregistree.`);
      return;
    }

    if (sub === "remove") {
      const name = interaction.options.getString("nom", true).toLowerCase();
      await prisma.customCommand.deleteMany({ where: { guildId, name } });
      await interaction.reply(`Commande personnalisee \`${name}\` supprimee (si elle existait).`);
      return;
    }

    const commands = await prisma.customCommand.findMany({ where: { guildId } });
    if (commands.length === 0) {
      await interaction.reply({ content: "Aucune commande personnalisee pour le moment.", ephemeral: true });
      return;
    }

    const guildData = await prisma.guild.findUnique({ where: { id: guildId } });
    const prefix = guildData?.prefix ?? "!";
    await interaction.reply(
      `Commandes personnalisees (${commands.length}) :\n${commands.map((c) => `\`${prefix}${c.name}\``).join(", ")}`,
    );
  },
};

export default command;
