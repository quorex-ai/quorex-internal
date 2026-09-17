import { useState, type FormEvent } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { Criterion } from '@quorex/shared';
import { apiFetch } from '../lib/api';
import { errorMessage } from '../lib/useApi';
import { FieldError, Input } from './ui/Field';

interface CriteriaListProps {
  criteria: Criterion[];
  /** Absent : liste en lecture seule (tableau de bord). */
  milestoneId?: string;
  onChanged?: (criteria: Criterion[]) => void;
}

interface CriteriaResponse {
  criteria: Criterion[];
}

/**
 * Liste de notes de la reference : cercle de coche, titre barre quand fait,
 * separateurs en pointilles.
 */
export function CriteriaList({ criteria, milestoneId, onChanged }: CriteriaListProps): JSX.Element {
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editable = milestoneId !== undefined && onChanged !== undefined;

  const toggle = async (criterion: Criterion): Promise<void> => {
    if (!editable) return;
    setError(null);
    try {
      const result = await apiFetch<CriteriaResponse>(`/milestones/criteria/${criterion.id}`, {
        method: 'PATCH',
        body: { checked: !criterion.checked },
      });
      onChanged(result.criteria);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const remove = async (criterion: Criterion): Promise<void> => {
    if (!editable) return;
    setError(null);
    try {
      const result = await apiFetch<CriteriaResponse>(`/milestones/criteria/${criterion.id}`, {
        method: 'DELETE',
      });
      onChanged(result.criteria);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const add = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!editable || label.trim().length === 0) return;

    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<CriteriaResponse>(`/milestones/${milestoneId}/criteria`, {
        method: 'POST',
        body: { label },
      });
      onChanged(result.criteria);
      setLabel('');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-8 pb-8">
      {criteria.length === 0 && (
        <p className="border-t border-card-line py-6 text-body text-muted">
          Aucun critère d'acceptation. Tant qu'un jalon n'en a pas, il peut être fermé sans condition.
        </p>
      )}

      <ul className="border-t border-card-line">
        {criteria.map((criterion) => (
          <li
            key={criterion.id}
            className="group flex items-start gap-4 border-b border-dashed border-card-line py-5 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => void toggle(criterion)}
              disabled={!editable}
              aria-pressed={criterion.checked}
              aria-label={criterion.checked ? 'Décocher le critère' : 'Cocher le critère'}
              className={[
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                criterion.checked
                  ? 'border-pill-pink-ink bg-pill-pink-ink text-white'
                  : 'border-card-line bg-card hover:border-muted',
                editable ? '' : 'cursor-default',
              ].join(' ')}
            >
              {criterion.checked && <Check size={14} strokeWidth={3} />}
            </button>

            <div className="min-w-0 flex-1">
              <p
                className={[
                  'text-body font-medium',
                  criterion.checked ? 'text-muted line-through' : 'text-ink',
                ].join(' ')}
              >
                {criterion.label}
              </p>
              {criterion.checked && criterion.checkedAt && (
                <p className="mt-1 text-sub text-muted">Coché le {criterion.checkedAt.slice(0, 10)}</p>
              )}
            </div>

            {editable && (
              <button
                type="button"
                onClick={() => void remove(criterion)}
                aria-label="Supprimer le critère"
                className="rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {editable && (
        <form className="mt-5 flex flex-col gap-3" onSubmit={(event) => void add(event)}>
          <div className="flex gap-3">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ajouter un critère d'acceptation"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={busy || label.trim().length === 0}
              className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sub font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={18} strokeWidth={2} />
              Ajouter
            </button>
          </div>
          <FieldError message={error} />
        </form>
      )}

      {!editable && <FieldError message={error} />}
    </div>
  );
}
