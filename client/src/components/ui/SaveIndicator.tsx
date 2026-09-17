import { CircleAlert, Check, LoaderCircle } from 'lucide-react';
import type { SaveStatus } from '../../lib/useSaver';

/** Petit état d'enregistrement, à côté du titre de la carte. */
export function SaveIndicator({ status }: { status: SaveStatus }): JSX.Element | null {
  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <span className="flex items-center gap-2 text-sub text-muted">
        <LoaderCircle size={14} className="animate-spin" />
        Enregistrement…
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span className="flex items-center gap-2 text-sub text-pill-green-ink">
        <Check size={14} strokeWidth={2.5} />
        Enregistré
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sub text-pill-pink-ink">
      <CircleAlert size={14} strokeWidth={2} />
      Non enregistré
    </span>
  );
}
