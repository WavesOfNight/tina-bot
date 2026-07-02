export function PageHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-lavender-100 text-lg">
        <span aria-hidden="true">{icon}</span>
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold text-lavender-900">{title}</h1>
        {subtitle && <p className="text-xs text-lavender-500">{subtitle}</p>}
      </div>
    </div>
  );
}
