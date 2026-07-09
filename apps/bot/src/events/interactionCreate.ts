import { Events, type Interaction } from "discord.js";
import { prisma } from "@tina/database";
import { commandMap } from "../commands/index.js";
import { buttonHandlerMap } from "../buttons/index.js";
import { selectMenuHandlerMap } from "../selectMenus/index.js";

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    const command = commandMap.get(interaction.commandName);
    if (!command) return;

    if (interaction.guildId) {
      const toggle = await prisma.slashCommandToggle.findUnique({
        where: { guildId_name: { guildId: interaction.guildId, name: interaction.commandName } },
      });
      if (toggle && !toggle.enabled) {
        await interaction.reply({ content: "Cette commande est desactivee sur ce serveur.", ephemeral: true });
        return;
      }
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Erreur dans la commande /${interaction.commandName}`, error);
      const payload = { content: "Une erreur est survenue lors de l'execution de cette commande.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const [prefix, ...parts] = interaction.customId.split(":");
    const handler = buttonHandlerMap.get(prefix);
    if (!handler) return;

    try {
      await handler.execute(interaction, parts);
    } catch (error) {
      console.error(`Erreur dans le bouton ${interaction.customId}`, error);
      const payload = { content: "Une erreur est survenue.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const [prefix, ...parts] = interaction.customId.split(":");
    const handler = selectMenuHandlerMap.get(prefix);
    if (!handler) return;

    try {
      await handler.execute(interaction, parts);
    } catch (error) {
      console.error(`Erreur dans le menu ${interaction.customId}`, error);
      const payload = { content: "Une erreur est survenue.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
  }
}
