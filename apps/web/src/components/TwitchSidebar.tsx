"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Keyboard,
  PartyPopper,
  ScrollText,
  ShieldCheck,
  Timer,
  Settings,
  TvMinimalPlay,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/twitch", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/dashboard/twitch/commandes", label: "Commandes", icon: Keyboard },
  { href: "/dashboard/twitch/giveaways", label: "Giveaways", icon: PartyPopper },
  { href: "/dashboard/twitch/logs", label: "Logs", icon: ScrollText },
  { href: "/dashboard/twitch/moderation", label: "Moderation", icon: ShieldCheck },
  { href: "/dashboard/twitch/timers", label: "Timers", icon: Timer },
  { href: "/dashboard/twitch/parametres", label: "Parametres", icon: Settings },
];

export function TwitchSidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-panel flex w-56 flex-shrink-0 flex-col rounded-aero p-4 shadow-glass">
      <div className="mb-4 flex items-center justify-center gap-2 text-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#9146FF] text-white">
          <TvMinimalPlay size={16} strokeWidth={2.25} aria-hidden="true" />
        </div>
        <div className="text-left">
          <p className="font-display text-lg font-semibold text-lavender-900">TINA BOT</p>
          <p className="text-[10px] tracking-wide text-lavender-400">BOT TWITCH</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                active ? "bg-[#9146FF] font-medium text-white shadow-sm" : "text-lavender-600 hover:bg-white/60"
              }`}
            >
              <Icon size={17} strokeWidth={2.25} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 border-t border-lavender-200 pt-3">
        <Link href="/dashboard" className="text-xs text-lavender-500 underline">
          Retour aux serveurs Discord
        </Link>
      </div>
    </aside>
  );
}
