"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  section: string;
  global?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "", label: "Tableau de bord", icon: "🏠", section: "top" },
  { href: "bienvenue", label: "Bienvenue", icon: "🎁", section: "modules" },
  { href: "commandes", label: "Commandes Perso", icon: "⌨️", section: "modules" },
  { href: "niveaux", label: "Niveaux", icon: "🏆", section: "modules" },
  { href: "jeux", label: "Jeux", icon: "🎮", section: "modules" },
  { href: "moderation", label: "Moderation", icon: "🛡️", section: "modules" },
  { href: "slash-commands", label: "Slash Commands", icon: "🔤", section: "modules" },
  { href: "giveaways", label: "Giveaways", icon: "🎉", section: "modules" },
  { href: "reaction-buttons", label: "Reaction Buttons", icon: "🖱️", section: "modules" },
  { href: "alertes", label: "Alertes", icon: "🔔", section: "modules" },
  { href: "radio", label: "Radio", icon: "📻", section: "modules" },
];

const SETTINGS_ITEM: NavItem = { href: "/dashboard/settings", label: "Parametres", icon: "⚙️", section: "global", global: true };

export function Sidebar({ guildId, showSettings = true }: { guildId: string; showSettings?: boolean }) {
  const pathname = usePathname();
  const base = `/dashboard/${guildId}`;
  const items = showSettings ? [...NAV_ITEMS, SETTINGS_ITEM] : NAV_ITEMS;

  return (
    <aside className="glass-panel flex w-56 flex-shrink-0 flex-col rounded-aero p-4 shadow-glass">
      <div className="mb-4 text-center">
        <p className="font-display text-lg font-semibold text-lavender-900">TINA BOT</p>
        <p className="text-[10px] tracking-wide text-lavender-400">PANEL WEB</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const href = item.global ? item.href : item.href ? `${base}/${item.href}` : base;
          const active = pathname === href;
          return (
            <Link
              key={item.label}
              href={href}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                active ? "bg-white font-medium text-lavender-900 shadow-sm" : "text-lavender-600 hover:bg-white/50"
              }`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 border-t border-lavender-200 pt-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cream-100 text-sm">🎀</div>
          <div>
            <p className="text-xs font-medium text-lavender-900">Tina [BOT]</p>
            <p className="flex items-center gap-1 text-[10px] text-aqua-600">
              <span className="h-1.5 w-1.5 rounded-full bg-aqua-400" /> En ligne
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
