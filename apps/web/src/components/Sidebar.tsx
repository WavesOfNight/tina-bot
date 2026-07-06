"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gift,
  Keyboard,
  Trophy,
  Gamepad2,
  ShieldCheck,
  SlashSquare,
  PartyPopper,
  MousePointerClick,
  Bell,
  Radio,
  Link2,
  Settings,
  TvMinimalPlay,
  Star,
  Ticket,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: string;
  global?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "", label: "Tableau de bord", icon: LayoutDashboard, section: "top" },
  { href: "bienvenue", label: "Bienvenue", icon: Gift, section: "modules" },
  { href: "commandes", label: "Commandes Perso", icon: Keyboard, section: "modules" },
  { href: "niveaux", label: "Niveaux", icon: Trophy, section: "modules" },
  { href: "jeux", label: "Jeux", icon: Gamepad2, section: "modules" },
  { href: "moderation", label: "Moderation", icon: ShieldCheck, section: "modules" },
  { href: "slash-commands", label: "Slash Commands", icon: SlashSquare, section: "modules" },
  { href: "giveaways", label: "Giveaways", icon: PartyPopper, section: "modules" },
  { href: "reaction-buttons", label: "Reaction Buttons", icon: MousePointerClick, section: "modules" },
  { href: "starboard", label: "Starboard", icon: Star, section: "modules" },
  { href: "tickets", label: "Tickets", icon: Ticket, section: "modules" },
  { href: "alertes", label: "Alertes", icon: Bell, section: "modules" },
  { href: "radio", label: "Radio", icon: Radio, section: "modules" },
  { href: "invitation", label: "Invitation", icon: Link2, section: "modules" },
];

const SETTINGS_ITEM: NavItem = { href: "/dashboard/settings", label: "Parametres", icon: Settings, section: "global", global: true };
const TWITCH_ITEM: NavItem = { href: "/dashboard/twitch", label: "Bot Twitch", icon: TvMinimalPlay, section: "global", global: true };

export function Sidebar({ guildId, showSettings = true }: { guildId: string; showSettings?: boolean }) {
  const pathname = usePathname();
  const base = `/dashboard/${guildId}`;
  const items = showSettings ? [...NAV_ITEMS, TWITCH_ITEM, SETTINGS_ITEM] : NAV_ITEMS;

  return (
    <aside className="glass-panel flex w-56 flex-shrink-0 flex-col rounded-aero p-4 shadow-glass">
      <div className="mb-4 flex items-center justify-center gap-2 text-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-discord-400 text-sm font-bold text-white">T</div>
        <div className="text-left">
          <p className="font-display text-lg font-semibold text-lavender-900">TINA BOT</p>
          <p className="text-[10px] tracking-wide text-lavender-400">PANEL WEB</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const href = item.global ? item.href : item.href ? `${base}/${item.href}` : base;
          const active = pathname === href;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                active ? "bg-discord-400 font-medium text-white shadow-sm" : "text-lavender-600 hover:bg-white/60"
              }`}
            >
              <Icon size={17} strokeWidth={2.25} aria-hidden="true" />
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
