import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import type { GuildMember } from "discord.js";

const WIDTH = 900;
const HEIGHT = 300;

function drawBubble(ctx: any, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function generateWelcomeImage(member: GuildMember, welcomeText: string): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#EEEDFE");
  gradient.addColorStop(0.5, "#E1F5EE");
  gradient.addColorStop(1, "#FBEAF0");
  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 28);
  ctx.fill();

  drawBubble(ctx, 80, 60, 26, 0.5);
  drawBubble(ctx, 120, 220, 16, 0.4);
  drawBubble(ctx, 830, 70, 20, 0.4);
  drawBubble(ctx, 800, 240, 30, 0.5);
  drawBubble(ctx, 450, 40, 10, 0.35);

  ctx.strokeStyle = "#7F77DD";
  ctx.lineWidth = 6;
  roundRect(ctx, 6, 6, WIDTH - 12, HEIGHT - 12, 24);
  ctx.stroke();

  const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
  const avatarSize = 150;
  const avatarX = WIDTH / 2 - avatarSize / 2;
  const avatarY = 40;

  try {
    const avatarImage = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(WIDTH / 2, avatarY + avatarSize / 2, avatarSize / 2 + 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(WIDTH / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    ctx.strokeStyle = "#D4537E";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(WIDTH / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  } catch {
    // Avatar failed to load, still render the rest of the card.
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#26215C";
  let fontSize = 36;
  ctx.font = `bold ${fontSize}px sans-serif`;
  while (ctx.measureText(welcomeText).width > WIDTH - 80 && fontSize > 18) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }
  ctx.fillText(welcomeText, WIDTH / 2, avatarY + avatarSize + 55);

  ctx.font = "22px sans-serif";
  ctx.fillStyle = "#534AB7";
  ctx.fillText(`Membre n${member.guild.memberCount}`, WIDTH / 2, avatarY + avatarSize + 88);

  return canvas.toBuffer("image/png");
}
