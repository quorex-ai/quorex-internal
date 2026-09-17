import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import {
  JOURNAL_ENTITY_LABELS,
  JOURNAL_ENTITY_TYPES,
  type JournalEntry,
  type JournalPage,
} from '@quorex/shared';
import { PageHeader } from '../components/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Pill } from '../components/ui/Pill';
import { Button } from '../components/ui/Button';
import { PillSelect } from '../components/ui/Field';
import { useTeam } from '../lib/store';
import { useResource } from '../lib/useApi';
import { formatDateTime } from '../lib/format';
import { FIELD_LABELS, readableChange } from '../lib/labels';

function describe(entry: JournalEntry): string {
  if (entry.field === 'created') return 'création';
  if (entry.field === 'deleted') return 'suppression';

  const field = FIELD_LABELS[entry.field] ?? entry.field;
  return `${field} : ${readableChange(entry.oldValue, entry.newValue)}`;
}

export function Journal(): JSX.Element {
  const { users } = useTeam();
  const [entityType, setEntityType] = useState('');
  const [actorId, setActorId] = useState('');
  const [page, setPage] = useState(1);

  const path = useMemo(() => {
    const parameters = new URLSearchParams();
    if (entityType) parameters.set('entityType', entityType);
    if (actorId) parameters.set('actorId', actorId);
    parameters.set('page', String(page));
    return `/journal?${parameters.toString()}`;
  }, [entityType, actorId, page]);

  const journal = useResource<JournalPage>(path);

  const entries = journal.data?.entries ?? [];
  const total = journal.data?.total ?? 0;
  const pageSize = journal.data?.pageSize ?? 50;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader
        title="Journal"
        actions={
          <>
            <PillSelect
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Toutes les entités</option>
              {JOURNAL_ENTITY_TYPES.map((value) => (
                <option key={value} value={value}>
                  {JOURNAL_ENTITY_LABELS[value]}
                </option>
              ))}
            </PillSelect>
            <PillSelect
              value={actorId}
              onChange={(event) => {
                setActorId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tout le monde</option>
              {users.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
              <option value="system">Système (scripts)</option>
            </PillSelect>
          </>
        }
      />

      <Card>
        <CardHeader
          icon={ScrollText}
          title="Toutes les mutations"
          meta={<span className="text-sub text-muted">{total} entrée(s), lecture seule</span>}
        />

        <ul className="border-t border-card-line">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-5 border-b border-card-line px-8 py-4 last:border-b-0">
              <span className="w-[150px] shrink-0 whitespace-nowrap text-sub text-muted">
                {formatDateTime(entry.at)}
              </span>
              <Pill label={JOURNAL_ENTITY_LABELS[entry.entityType]} tone="gray" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body text-ink">{entry.entityLabel}</p>
                <p className="truncate text-sub text-muted">{describe(entry)}</p>
              </div>
              {entry.actorName ? (
                <span className="flex shrink-0 items-center gap-2">
                  <Avatar name={entry.actorName} size={28} />
                  <span className="text-sub text-muted">{entry.actorName}</span>
                </span>
              ) : (
                <span className="shrink-0 text-sub text-muted">système</span>
              )}
            </li>
          ))}

          {entries.length === 0 && (
            <li className="px-8 py-6 text-body text-muted">Aucune entrée pour ces filtres.</li>
          )}
        </ul>

        <div className="flex items-center justify-between px-8 py-5">
          <span className="text-sub text-muted">
            Page {page} sur {pages}
          </span>
          <div className="flex items-center gap-3">
            <Button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              icon={<ChevronLeft size={18} strokeWidth={1.75} />}
            >
              Précédent
            </Button>
            <Button
              disabled={page >= pages}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
              icon={<ChevronRight size={18} strokeWidth={1.75} />}
            >
              Suivant
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
