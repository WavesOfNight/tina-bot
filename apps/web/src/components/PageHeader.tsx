import type { LucideIcon } from "lucide-react";

export function PageHeader({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-discord-400 text-white shadow-glass">
        <Icon size={19} strokeWidth={2.25} aria-hidden="true" />
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold text-lavender-900">{title}</h1>
        {subtitle && <p className="text-xs text-lavender-500">{subtitle}</p>}
      </div>
    </div>
  );
}
