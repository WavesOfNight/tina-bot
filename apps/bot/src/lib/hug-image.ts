import { createCanvas, loadImage } from "@napi-rs/canvas";

const WIDTH = 520;
const HEIGHT = 380;

// Local y-coordinate of the top of the body shape drawn by chibiBody() (see path below),
// used to derive head placement so it always sits on the character's neck.
const BODY_TOP_OFFSET = 20;
const HEAD_OVERLAP = 16;

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

interface Anchor {
  x: number;
  y: number;
  radius: number;
  fill: string;
  mirror?: boolean;
}

function headPosition(anchor: Anchor) {
  return { x: anchor.x, y: anchor.y - BODY_TOP_OFFSET - anchor.radius + HEAD_OVERLAP, r: anchor.radius };
}

function chibiBody(ctx: any, anchor: Anchor) {
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  if (anchor.mirror) ctx.scale(-1, 1);
  ctx.fillStyle = anchor.fill;
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

function huggingArms(ctx: any, a: Anchor, b: Anchor) {
  const left = a.x < b.x ? a : b;
  const right = a.x < b.x ? b : a;
  const midX = (left.x + right.x) / 2;

  ctx.strokeStyle = "#2c2c2a";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";

  // Left character's arm wrapping around the right character's back.
  ctx.beginPath();
  ctx.moveTo(left.x + 18, left.y + 5);
  ctx.quadraticCurveTo(midX, left.y + 45, right.x + 32, right.y - 5);
  ctx.stroke();

  // Right character's arm wrapping around the left character's back.
  ctx.beginPath();
  ctx.moveTo(right.x - 18, right.y + 5);
  ctx.quadraticCurveTo(midX, right.y + 60, left.x - 32, left.y - 5);
  ctx.stroke();
}

function heart(ctx: any, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#F4879B";
  ctx.beginPath();
  ctx.moveTo(0, size * 0.35);
  ctx.bezierCurveTo(-size, -size * 0.6, -size * 1.6, size * 0.5, 0, size * 1.3);
  ctx.bezierCurveTo(size * 1.6, size * 0.5, size, -size * 0.6, 0, size * 0.35);
  ctx.fill();
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
  [
    [60, 60, 14],
    [460, 90, 10],
    [40, 320, 18],
    [480, 300, 12],
  ].forEach(([cx, cy, r]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

interface HugPose {
  bodyA: Omit<Anchor, "fill">;
  bodyB: Omit<Anchor, "fill">;
  fillA: string;
  fillB: string;
  heartAt?: { x: number; y: number };
}

const POSES: HugPose[] = [
  {
    bodyA: { x: 195, y: 220, radius: 55 },
    bodyB: { x: 325, y: 220, radius: 55, mirror: true },
    fillA: "#AFA9EC",
    fillB: "#F0997B",
    heartAt: { x: 260, y: 90 },
  },
  {
    bodyA: { x: 200, y: 235, radius: 52 },
    bodyB: { x: 320, y: 200, radius: 58, mirror: true },
    fillA: "#9FE1CB",
    fillB: "#F4C0D1",
    heartAt: { x: 255, y: 95 },
  },
  {
    bodyA: { x: 190, y: 210, radius: 50 },
    bodyB: { x: 330, y: 235, radius: 55, mirror: true },
    fillA: "#7F77DD",
    fillB: "#D85A30",
  },
  {
    bodyA: { x: 215, y: 230, radius: 58 },
    bodyB: { x: 305, y: 215, radius: 50, mirror: true },
    fillA: "#F4C0D1",
    fillB: "#9FE1CB",
    heartAt: { x: 260, y: 100 },
  },
  {
    bodyA: { x: 185, y: 225, radius: 53 },
    bodyB: { x: 335, y: 225, radius: 53, mirror: true },
    fillA: "#F0997B",
    fillB: "#AFA9EC",
  },
];

export async function generateHugImage(userAAvatarUrl: string, userBAvatarUrl: string): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  background(ctx);

  const pose = POSES[Math.floor(Math.random() * POSES.length)];
  const anchorA: Anchor = { ...pose.bodyA, fill: pose.fillA };
  const anchorB: Anchor = { ...pose.bodyB, fill: pose.fillB };

  chibiBody(ctx, anchorA);
  chibiBody(ctx, anchorB);
  huggingArms(ctx, anchorA, anchorB);
  if (pose.heartAt) heart(ctx, pose.heartAt.x, pose.heartAt.y, 16);

  const [imageA, imageB] = await Promise.all([
    loadImage(userAAvatarUrl).catch(() => null),
    loadImage(userBAvatarUrl).catch(() => null),
  ]);

  const headA = headPosition(anchorA);
  const headB = headPosition(anchorB);
  if (imageA) drawAvatar(ctx, imageA, headA.x, headA.y, headA.r, "#7F77DD");
  if (imageB) drawAvatar(ctx, imageB, headB.x, headB.y, headB.r, "#D4537E");

  ctx.strokeStyle = "#7F77DD";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, WIDTH - 8, HEIGHT - 8);

  return canvas.toBuffer("image/png");
}
