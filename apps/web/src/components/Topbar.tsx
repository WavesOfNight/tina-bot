import { signOut } from "@/auth";

export function Topbar({
  guildName,
  guildIcon,
  guildId,
  userName,
  userAvatar,
}: {
  guildName: string;
  guildIcon: string | null;
  guildId: string;
  userName: string;
  userAvatar: string | null | undefined;
}) {
  return (
    <div className="glass-panel mb-4 flex items-center justify-between rounded-full px-4 py-2 shadow-glass">
      <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-sm">
        {guildIcon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png`} alt={guildName} className="h-5 w-5 rounded-full" />
        ) : (
          <span aria-hidden="true">🖥️</span>
        )}
        <span className="font-medium text-lavender-900">{guildName}</span>
      </div>
      <div className="flex items-center gap-3">
        <a href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-lavender-600" title="Changer de serveur">
          ⇄
        </a>
        <a href="/dashboard/settings" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-lavender-600" title="Parametres du bot">
          ⚙️
        </a>
        <div className="flex items-center gap-2 rounded-full bg-white/70 py-1 pl-1 pr-3">
          {userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatar} alt={userName} className="h-6 w-6 rounded-full" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-coral-200" />
          )}
          <span className="text-xs text-lavender-800">{userName}</span>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-lavender-600" title="Se deconnecter">
            ⏻
          </button>
        </form>
      </div>
    </div>
  );
}
