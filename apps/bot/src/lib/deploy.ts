import { REST, Routes } from "discord.js";
import { commands } from "../commands/index.js";
import { config } from "../config.js";

export async function deployCommands(clientId: string, token: string) {
  const rest = new REST().setToken(token);
  const body = commands.map((command) => command.data.toJSON());

  if (config.devGuildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, config.devGuildId), { body });
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
  }

  return body.length;
}
