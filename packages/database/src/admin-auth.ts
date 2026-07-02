import bcrypt from "bcryptjs";
import { prisma } from "./client.js";

export async function hasAdminUser(): Promise<boolean> {
  const count = await prisma.adminUser.count();
  return count > 0;
}

export async function createAdminUser(username: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.adminUser.create({ data: { username, passwordHash } });
}

export async function verifyAdminCredentials(username: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export async function changeAdminPassword(username: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const admin = await verifyAdminCredentials(username, currentPassword);
  if (!admin) return false;

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash } });
  return true;
}
