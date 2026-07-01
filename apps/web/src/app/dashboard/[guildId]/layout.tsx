import { redirect } from "next/navigation";
import { auth, type SessionRole } from "@/auth";
import { canUserManageGuild, getGuildInfo } from "@/lib/discord";
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

  const role = (session as typeof session & { role?: SessionRole }).role ?? "owner";
  if (role === "guild-admin") {
    const accessToken = (session as typeof session & { accessToken?: string }).accessToken;
    const allowed = accessToken ? await canUserManageGuild(accessToken, params.guildId) : false;
    if (!allowed) redirect("/dashboard");
  }

  const guild = await getGuildInfo(params.guildId);
  if (!guild) redirect("/dashboard");

  const showSettings = role === "owner";

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-4 p-4">
      <Sidebar guildId={params.guildId} showSettings={showSettings} />
      <main className="flex-1">
        <Topbar
          guildName={guild.name}
          guildIcon={guild.icon}
          guildId={guild.id}
          userName={session.user?.name ?? "Admin"}
          userAvatar={session.user?.image}
          showSettingsLink={showSettings}
        />
        {children}
      </main>
    </div>
  );
}
