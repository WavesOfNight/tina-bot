import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  StringSelectMenuInteraction,
} from "discord.js";

export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface ButtonHandler {
  prefix: string;
  execute: (interaction: ButtonInteraction, parts: string[]) => Promise<void>;
}

export interface SelectMenuHandler {
  prefix: string;
  execute: (interaction: StringSelectMenuInteraction, parts: string[]) => Promise<void>;
}
