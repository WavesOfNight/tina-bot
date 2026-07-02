import { createCanvas, loadImage } from "@napi-rs/canvas";

const WIDTH = 520;
const HEIGHT = 380;

function drawAvatar(ctx: any, image: any, x: number, y: number, radius: number, ringColor: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();

  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function chibiBody(ctx: any, x: number, y: number, fill: string, mirror = false) {
  ctx.save();
  ctx.translate(x, y);
  if (mirror) ctx.scale(-1, 1);
  ctx.fillStyle = fill;
  ctx.strokeStyle = "#2c2c2a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-45, 100);
  ctx.quadraticCurveTo(-60, 20, -20, -10);
  ctx.quadraticCurveTo(0, -20, 20, -10);
  ctx.quadraticCurveTo(60, 20, 45, 100);
  ctx.quadraticCurveTo(0, 120, -45, 100);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function background(ctx: any) {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#EEEDFE");
  gradient.addColorStop(0.5, "#E1F5EE");
  gradient.addColorStop(1, "#FBEAF0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  [[60, 60, 14], [460, 90, 10], [40, 320, 18], [480, 300, 12]].forEach(([cx, cy, r]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

interface HugPose {
  draw: (ctx: any) => void;
  headA: { x: number; y: number; r: number };
  headB: { x: number; y: number; r: number };
}

const POSES: HugPose[] = [
  {
    draw: (ctx) => {
      chibiBody(ctx, 190, 210, "#AFA9EC");
      chibiBody(ctx, 330, 210, "#F0997B", true);
      ctx.strokeStyle = "#2c2c2a";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(230, 190);
      ctx.quadraticCurveTo(260, 230, 290, 190);
      ctx.stroke();
    },
    headA: { x: 190, y: 150, r: 55 },
    headB: { x: 330, y: 150, r: 55 },
  },
  {
    draw: (ctx) => {
      chibiBody(ctx, 210, 220, "#9FE1CB");
      chibiBody(ctx, 310, 220, "#F4C0D1", true);
      ctx.strokeStyle = "#2c2c2a";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(240, 170);
      ctx.quadraticCurveTo(260, 150, 280, 170);
      ctx.stroke();
    },
    headA: { x: 205, y: 155, r: 52 },
    headB: { x: 315, y: 165, r: 58 },
  },
  {
    draw: (ctx) => {
      chibiBody(ctx, 200, 230, "#7F77DD");
      chibiBody(ctx, 320, 190, "#D85A30", true);
      ctx.strokeStyle = "#2c2c2a";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(235, 200);
      ctx.quadraticCurveTo(260, 175, 285, 155);
      ctx.stroke();
    },
    headA: { x: 195, y: 165, r: 50 },
    headB: { x: 320, y: 120, r: 50 },
  },
];

export async function generateHugImage(userAAvatarUrl: string, userBAvatarUrl: string): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  background(ctx);

  const pose = POSES[Math.floor(Math.random() * POSES.length)];
  pose.draw(ctx);

  const [imageA, imageB] = await Promise.all([
    loadImage(userAAvatarUrl).catch(() => null),
    loadImage(userBAvatarUrl).catch(() => null),
  ]);

  if (imageA) drawAvatar(ctx, imageA, pose.headA.x, pose.headA.y, pose.headA.r, "#7F77DD");
  if (imageB) drawAvatar(ctx, imageB, pose.headB.x, pose.headB.y, pose.headB.r, "#D4537E");

  ctx.strokeStyle = "#7F77DD";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, WIDTH - 8, HEIGHT - 8);

  return canvas.toBuffer("image/png");
}
