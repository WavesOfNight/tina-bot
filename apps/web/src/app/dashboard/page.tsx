import { redirect } from "next/navigation";
import { getBotConfig } from "@tina/database";
import { auth, type SessionRole } from "@/auth";
import { canManageGuild, getBotGuilds, getUserGuilds } from "@/lib/discord";

export const dynamic = "force-dynamic";

export default async function GuildPickerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session as typeof session & { role?: SessionRole }).role ?? "owner";
  const accessToken = (session as typeof session & { accessToken?: string }).accessToken;

  const botConfig = await getBotConfig();
  const botGuilds = botConfig ? await getBotGuilds() : [];

  let guilds = botGuilds;
  if (role === "guild-admin") {
    const userGuilds = accessToken ? await getUserGuilds(accessToken) : [];
    const manageableIds = new Set(userGuilds.filter((g) => canManageGuild(g.permissions)).map((g) => g.id));
    guilds = botGuilds.filter((g) => manageableIds.has(g.id));
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-lavender-900">Choisis un serveur</h1>
        {role === "owner" && (
          <a href="/dashboard/settings" className="bubble-btn rounded-full bg-lavender-400 px-4 py-2 text-sm font-medium text-white shadow-glass">
            Parametres du bot
          </a>
        )}
      </div>

      {!botConfig && role === "owner" && (
        <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
          <p className="text-sm text-lavender-800">
            Aucun token de bot configure pour le moment. Rends-toi dans{" "}
            <a href="/dashboard/settings" className="font-medium text-blush-400 underline">
              Parametres
            </a>{" "}
            pour connecter Tina [BOT].
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {guilds.map((guild) => (
          <a
            key={guild.id}
            href={`/dashboard/${guild.id}`}
            className="glass-panel flex items-center gap-3 rounded-aero p-4 shadow-glass"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lavender-100 font-medium text-lavender-800">
              {guild.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                  alt={guild.name}
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                guild.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <p className="font-medium text-lavender-900">{guild.name}</p>
          </a>
        ))}
        {botConfig && guilds.length === 0 && role === "owner" && (
          <p className="text-lavender-600">
            Tina [BOT] n&apos;est encore sur aucun serveur. Invite-la depuis la page Parametres.
          </p>
        )}
        {guilds.length === 0 && role === "guild-admin" && (
          <p className="text-lavender-600">
            Aucun serveur geerable trouve. Tina [BOT] doit etre presente sur un serveur ou tu as la permission
            &quot;Gerer le serveur&quot;.
          </p>
        )}
      </div>
    </main>
  );
}
