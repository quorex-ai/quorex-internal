import type { LucideIcon } from 'lucide-react';

export interface Stat {
  icon: LucideIcon;
  value: string;
  label: string;
}

/** Pilule blanche bordee, indicateurs separes par des barres verticales fines. */
export function StatsRow({ stats }: { stats: Stat[] }): JSX.Element {
  return (
    <div className="mb-8 inline-flex items-center rounded-full border border-card-line bg-card px-2 py-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="flex items-center">
            {index > 0 && <span className="mx-2 h-7 w-px bg-card-line" aria-hidden="true" />}
            <div className="flex items-center gap-3 px-6">
              <Icon size={20} strokeWidth={1.5} className="text-ink" />
              <p className="text-[24px] font-semibold leading-none text-ink">{stat.value}</p>
              <p className="text-body text-muted">{stat.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
