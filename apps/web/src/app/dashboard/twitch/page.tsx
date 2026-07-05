import { prisma, getTopTwitchCommands, getTwitchDailyStats, getTwitchLeaderboard } from "@tina/database";
import { PageHeader } from "@/components/PageHeader";
import { LayoutDashboard } from "lucide-react";

export const dynamic = "force-dynamic";

const DAYS = 7;
const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function TwitchDashboardPage() {
  const [config, stats, topCommands, leaderboard] = await Promise.all([
    prisma.twitchBotConfig.findUnique({ where: { id: 1 } }),
    getTwitchDailyStats(DAYS),
    getTopTwitchCommands(8),
    getTwitchLeaderboard(8),
  ]);

  const byDate = new Map(stats.map((s) => [s.date, s]));
  const days: { date: string; label: string; messages: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, label: DAY_LABELS[d.getDay()], messages: byDate.get(key)?.messages ?? 0 });
  }
  const maxMessages = Math.max(1, ...days.map((d) => d.messages));

  const today = byDate.get(todayKey());
  const isConnected = Boolean(config?.accessTokenEncrypted && config?.refreshTokenEncrypted);
  const isOnline = Boolean(config?.enabled && isConnected);

  return (
    <div>
      <PageHeader icon={LayoutDashboard} title="Tableau de bord" subtitle={`Apercu des 7 derniers jours${config?.channelName ? ` - #${config.channelName}` : ""}`} />

      <div className="mb-4 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-aqua-400" : "bg-lavender-200"}`} />
        <p className="text-sm text-lavender-700">{isOnline ? "Bot Twitch en ligne" : "Bot Twitch hors ligne"}</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="glass-panel rounded-aero p-4 shadow-glass">
          <p className="text-xs text-lavender-500">Messages</p>
          <p className="text-2xl font-semibold text-lavender-900">{today?.messages ?? 0}</p>
          <p className="text-xs text-aqua-600">aujourd&apos;hui</p>
        </div>
        <div className="glass-panel rounded-aero p-4 shadow-glass">
          <p className="text-xs text-lavender-500">Commandes</p>
          <p className="text-2xl font-semibold text-lavender-900">{today?.commands ?? 0}</p>
          <p className="text-xs text-aqua-600">aujourd&apos;hui</p>
        </div>
        <div className="glass-panel rounded-aero p-4 shadow-glass">
          <p className="text-xs text-lavender-500">Timeouts / Bans</p>
          <p className="text-2xl font-semibold text-lavender-900">{today?.timeouts ?? 0}</p>
          <p className="text-xs text-aqua-600">aujourd&apos;hui</p>
        </div>
      </div>

      <div className="glass-panel mb-4 rounded-aero p-5 shadow-glass">
        <p className="mb-3 text-xs text-lavender-500">Messages par jour</p>
        <div className="flex h-40 items-end gap-3">
          {days.map((d) => (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-t-lg bg-[#9146FF]"
                style={{ height: `${Math.max(4, (d.messages / maxMessages) * 100)}%` }}
                title={`${d.messages} message(s)`}
              />
              <p className="text-[10px] text-lavender-400">{d.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="glass-panel rounded-aero p-2 shadow-glass">
          <p className="border-b border-lavender-100 px-4 py-2 text-sm font-medium text-lavender-800">Top Commandes</p>
          {topCommands.length === 0 && <p className="p-4 text-sm text-lavender-600">Pas encore de donnees.</p>}
          {topCommands.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-lavender-100 px-4 py-2 text-sm last:border-none">
              <span className="text-lavender-900">{config?.prefix ?? "!"}{c.name}</span>
              <span className="text-lavender-500">{c.uses}</span>
            </div>
          ))}
        </div>
        <div className="glass-panel rounded-aero p-2 shadow-glass">
          <p className="border-b border-lavender-100 px-4 py-2 text-sm font-medium text-lavender-800">
            Classement Twitch <span className="font-normal text-lavender-400">({config?.prefix ?? "!"}leaderboard)</span>
          </p>
          {leaderboard.length === 0 && <p className="p-4 text-sm text-lavender-600">Pas encore de donnees.</p>}
          {leaderboard.map((c, index) => (
            <div key={c.id} className="flex items-center justify-between border-b border-lavender-100 px-4 py-2 text-sm last:border-none">
              <span className="text-lavender-900">
                {index + 1}. {c.username}
              </span>
              <span className="text-lavender-500">
                Niv. {c.level} - {c.xp} XP
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
