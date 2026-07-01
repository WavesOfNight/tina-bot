import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, Events, type GuildMember, type TextChannel } from "discord.js";
import { prisma } from "@tina/database";
import { applyPlaceholders } from "../lib/placeholders.js";
import { generateWelcomeImage } from "../lib/welcome-image.js";

export const name = Events.GuildMemberAdd;
export const once = false;

export async function execute(member: GuildMember) {
  const config = await prisma.welcomeConfig.findUnique({ where: { guildId: member.guild.id } });
  if (!config) return;

  if (config.autoRoleEnabled && config.autoRoleId) {
    const role = await member.guild.roles.fetch(config.autoRoleId).catch(() => null);
    if (role) await member.roles.add(role).catch(() => null);
  }

  if (config.channelId) {
    const channel = (await member.guild.channels.fetch(config.channelId).catch(() => null)) as TextChannel | null;
    if (channel?.isTextBased()) {
      const content = applyPlaceholders(config.message, member, member.guild);
      const files = [];

      if (config.imageEnabled) {
        try {
          const buffer = await generateWelcomeImage(member);
          files.push(new AttachmentBuilder(buffer, { name: "bienvenue.png" }));
        } catch {
          // Image generation failed (e.g. avatar unreachable); still send the text welcome.
        }
      }

      const components = [];
      if (config.reactionRoleEnabled && config.reactionRoleId) {
        components.push(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`welcome:join:${config.reactionRoleId}`)
              .setLabel("Rejoindre")
              .setEmoji("👋")
              .setStyle(ButtonStyle.Success),
          ),
        );
      }

      await channel.send({ content, files, components }).catch(() => null);
    }
  }

  if (config.dmEnabled) {
    const dmContent = applyPlaceholders(config.dmMessage, member, member.guild);
    await member.send(dmContent).catch(() => null);
  }
}
