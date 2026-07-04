import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import type { GuildMember } from "discord.js";

const WIDTH = 720;
const HEIGHT = 340;

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

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawImageCover(ctx: any, image: any, x: number, y: number, w: number, h: number) {
  const imageRatio = image.width / image.height;
  const boxRatio = w / h;
  let drawWidth = w;
  let drawHeight = h;

  if (imageRatio > boxRatio) {
    drawHeight = h;
    drawWidth = h * imageRatio;
  } else {
    drawWidth = w;
    drawHeight = w / imageRatio;
  }

  const drawX = x + (w - drawWidth) / 2;
  const drawY = y + (h - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

export async function generateWelcomeImage(
  member: GuildMember,
  welcomeText: string,
  backgroundUrl?: string | null,
): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 28);
  ctx.save();
  ctx.clip();

  let customBackgroundLoaded = false;
  if (backgroundUrl) {
    try {
      const backgroundImage = await loadImage(backgroundUrl);
      ctx.filter = "blur(6px)";
      drawImageCover(ctx, backgroundImage, -10, -10, WIDTH + 20, HEIGHT + 20);
      ctx.filter = "none";
      ctx.fillStyle = "rgba(20, 16, 40, 0.4)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      customBackgroundLoaded = true;
    } catch (error) {
      console.error("Fond personnalise de bienvenue introuvable ou invalide, utilisation du degrade par defaut.", error);
    }
  }

  if (!customBackgroundLoaded) {
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, "#EEEDFE");
    gradient.addColorStop(0.5, "#E1F5EE");
    gradient.addColorStop(1, "#FBEAF0");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawBubble(ctx, 80, 60, 26, 0.5);
    drawBubble(ctx, 120, 220, 16, 0.4);
    drawBubble(ctx, 830, 70, 20, 0.4);
    drawBubble(ctx, 800, 240, 30, 0.5);
    drawBubble(ctx, 450, 40, 10, 0.35);
  }

  ctx.restore();

  ctx.strokeStyle = customBackgroundLoaded ? "rgba(255,255,255,0.8)" : "#7F77DD";
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
  ctx.fillStyle = customBackgroundLoaded ? "#ffffff" : "#26215C";
  const maxTextWidth = WIDTH - 80;
  let fontSize = 32;
  ctx.font = `bold ${fontSize}px sans-serif`;
  let lines = wrapText(ctx, welcomeText, maxTextWidth);
  while (lines.length > 3 && fontSize > 16) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px sans-serif`;
    lines = wrapText(ctx, welcomeText, maxTextWidth);
  }

  const lineHeight = fontSize + 8;
  const textStartY = avatarY + avatarSize + 40;
  lines.forEach((line, index) => {
    ctx.fillText(line, WIDTH / 2, textStartY + index * lineHeight);
  });

  ctx.font = "20px sans-serif";
  ctx.fillStyle = customBackgroundLoaded ? "rgba(255,255,255,0.85)" : "#534AB7";
  ctx.fillText(`Membre N°${member.guild.memberCount}`, WIDTH / 2, textStartY + lines.length * lineHeight + 12);

  return canvas.toBuffer("image/png");
}
