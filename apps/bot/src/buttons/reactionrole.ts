import type { ButtonHandler } from "../types.js";

const handler: ButtonHandler = {
  prefix: "rr",
  async execute(interaction, parts) {
    const [, roleId] = parts;
    if (!interaction.guild || !interaction.member) return;

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);

    if (!role) {
      await interaction.reply({ content: "Ce role n'existe plus.", ephemeral: true });
      return;
    }

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(role);
      await interaction.reply({ content: `Role **${role.name}** retire.`, ephemeral: true });
    } else {
      await member.roles.add(role);
      await interaction.reply({ content: `Role **${role.name}** ajoute !`, ephemeral: true });
    }
  },
};

export default handler;
