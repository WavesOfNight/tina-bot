import type { ButtonHandler } from "../types.js";

const handler: ButtonHandler = {
  prefix: "welcome",
  async execute(interaction, parts) {
    const [action, roleId] = parts;
    if (action !== "join" || !interaction.guild) return;

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);

    if (!role) {
      await interaction.reply({ content: "Ce role n'existe plus.", ephemeral: true });
      return;
    }
    if (member.roles.cache.has(roleId)) {
      await interaction.reply({ content: "Tu as deja ce role !", ephemeral: true });
      return;
    }

    await member.roles.add(role);
    await interaction.reply({ content: `Bienvenue ! Le role **${role.name}** vient de t'etre attribue.`, ephemeral: true });
  },
};

export default handler;
