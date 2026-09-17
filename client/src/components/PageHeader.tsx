import type { ReactNode } from 'react';
import { formatLongDate } from '../lib/format';

interface PageHeaderProps {
  title: ReactNode;
  /** Ligne de date au-dessus du titre, comme sur la reference. */
  showDate?: boolean;
  actions?: ReactNode;
}

export function PageHeader({ title, showDate = true, actions }: PageHeaderProps): JSX.Element {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        {showDate && <p className="whitespace-nowrap text-date text-muted">{formatLongDate()}</p>}
        <h1 className="mt-2 text-title font-semibold tracking-tight text-ink">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
