import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getGuildInfo } from "@/lib/discord";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export default async function GuildDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { guildId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const guild = await getGuildInfo(params.guildId);
  if (!guild) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-4 p-4">
      <Sidebar guildId={params.guildId} />
      <main className="flex-1">
        <Topbar
          guildName={guild.name}
          guildIcon={guild.icon}
          guildId={guild.id}
          userName={session.user?.name ?? "Admin"}
          userAvatar={session.user?.image}
        />
        {children}
      </main>
    </div>
  );
}
