import { redirect } from "next/navigation";
import { auth, type SessionRole } from "@/auth";
import { TwitchSidebar } from "@/components/TwitchSidebar";

export default async function TwitchLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session as typeof session & { role?: SessionRole }).role ?? "owner";
  if (role !== "owner") redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-4 p-4">
      <TwitchSidebar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
