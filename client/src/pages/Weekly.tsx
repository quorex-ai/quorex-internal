import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, NotebookPen } from 'lucide-react';
import type { WeeklyReport, WeeklySummaryItem } from '@quorex/shared';
import { PageHeader } from '../components/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FieldError, Label, Textarea } from '../components/ui/Field';
import { SaveIndicator } from '../components/ui/SaveIndicator';
import { apiFetch } from '../lib/api';
import { useResource } from '../lib/useApi';
import { useSaver } from '../lib/useSaver';
import { formatIsoDate, formatShortDate, parseIsoDate, todayIso } from '../lib/format';
import { readableValue } from '../lib/labels';

interface WeeklyResponse {
  weekly: WeeklyReport;
}

const DAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function shift(weekStart: string, days: number): string {
  const date = parseIsoDate(weekStart);
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

/** Le serveur envoie « ancienne → nouvelle » en valeurs brutes : on les traduit. */
function readable(detail: string): string {
  return detail
    .split(' → ')
    .map((value) => readableValue(value === '—' ? null : value))
    .join(' → ');
}

function SummaryBlock({ title, items }: { title: string; items: WeeklySummaryItem[] }): JSX.Element {
  return (
    <div>
      <h3 className="mb-3 text-body font-medium text-ink">
        {title} <span className="text-muted">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-sub text-muted">Rien cette semaine.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={`${item.entityId}-${item.at}`} className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 truncate text-sub text-ink">{item.label}</span>
              {item.detail && (
                <span className="shrink-0 text-cap text-muted">{readable(item.detail)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Weekly(): JSX.Element {
  const [week, setWeek] = useState<string | null>(null);
  const weekly = useResource<WeeklyResponse>(week ? `/weekly?week=${week}` : '/weekly');

  const data = weekly.data?.weekly ?? null;

  return (
    <>
      <PageHeader
        title="Hebdo"
        actions={
          <>
            <Button
              icon={<ChevronLeft size={18} strokeWidth={1.75} />}
              onClick={() => data && setWeek(shift(data.weekStart, -7))}
            >
              Semaine précédente
            </Button>
            <Button
              icon={<ChevronRight size={18} strokeWidth={1.75} />}
              onClick={() => data && setWeek(shift(data.weekStart, 7))}
            >
              Semaine suivante
            </Button>
          </>
        }
      />

      {data && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[55fr_45fr]">
          <Card>
            <CardHeader
              icon={CalendarDays}
              title="Ce que dit le journal"
              meta={
                <span className="rounded-full border border-card-line px-4 py-1.5 text-sub text-muted">
                  {formatIsoDate(data.weekStart)} — {formatIsoDate(data.weekEnd)}
                </span>
              }
            />

            <div className="flex items-center gap-2 border-t border-card-line px-8 py-5">
              {DAY_INITIALS.map((initial, index) => {
                const day = shift(data.weekStart, index);
                const isToday = day === todayIso();
                return (
                  <div
                    key={day}
                    className={[
                      'flex flex-1 flex-col items-center gap-1 rounded-item px-2 py-2',
                      isToday ? 'bg-pill-pink text-pill-pink-ink' : 'text-muted',
                    ].join(' ')}
                  >
                    <span className="text-cap">{initial}</span>
                    <span className="text-body font-medium">{formatShortDate(day).split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-6 border-t border-card-line px-8 py-6">
              <SummaryBlock title="Jalons fermés" items={data.summary.milestonesClosed} />
              <SummaryBlock title="Tâches terminées" items={data.summary.tasksDone} />
              <SummaryBlock title="Tâches passées en cours" items={data.summary.tasksStarted} />
              <SummaryBlock title="Dates cibles modifiées" items={data.summary.datesChanged} />

              <div>
                <h3 className="mb-3 text-body font-medium text-ink">
                  En retard <span className="text-muted">({data.summary.late.length})</span>
                </h3>
                {data.summary.late.length === 0 ? (
                  <p className="text-sub text-muted">Rien en retard.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.summary.late.map((item) => (
                      <li key={item.id} className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 truncate text-sub text-ink">{item.title}</span>
                        <span className="shrink-0 text-cap text-pill-pink-ink">
                          {item.daysLate} jour(s) de retard
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          <ReportForm weekly={data} onSaved={weekly.reload} />
        </div>
      )}
    </>
  );
}

interface ReportFormProps {
  weekly: WeeklyReport;
  onSaved: () => Promise<void>;
}

function ReportForm({ weekly, onSaved }: ReportFormProps): JSX.Element {
  const [closedText, setClosedText] = useState('');
  const [inProgressText, setInProgressText] = useState('');
  const [blockedText, setBlockedText] = useState('');
  const saver = useSaver();

  useEffect(() => {
    setClosedText(weekly.report?.closedText ?? '');
    setInProgressText(weekly.report?.inProgressText ?? '');
    setBlockedText(weekly.report?.blockedText ?? '');
  }, [weekly]);

  /** Les trois champs partent ensemble, a la sortie de celui qui a change. */
  const persist = async (next: {
    closedText: string;
    inProgressText: string;
    blockedText: string;
  }): Promise<void> => {
    const unchanged =
      next.closedText === (weekly.report?.closedText ?? '') &&
      next.inProgressText === (weekly.report?.inProgressText ?? '') &&
      next.blockedText === (weekly.report?.blockedText ?? '');
    if (unchanged) return;

    const ok = await saver.save(() =>
      apiFetch(`/weekly/${weekly.weekStart}`, { method: 'PUT', body: next }),
    );
    if (ok) await onSaved();
  };

  return (
    <Card>
      <CardHeader
        icon={NotebookPen}
        title="Compte rendu"
        meta={<SaveIndicator status={saver.status} />}
        actions={
          weekly.report?.authorName ? (
            <span className="text-sub text-muted">par {weekly.report.authorName}</span>
          ) : (
            <span className="text-sub text-muted">non rempli</span>
          )
        }
      />
      <div className="flex flex-col gap-5 border-t border-card-line px-8 py-6">
        <label className="flex flex-col gap-2">
          <Label>Fermé</Label>
          <Textarea
            rows={5}
            value={closedText}
            onChange={(event) => setClosedText(event.target.value)}
            onBlur={() => void persist({ closedText, inProgressText, blockedText })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <Label>En cours</Label>
          <Textarea
            rows={5}
            value={inProgressText}
            onChange={(event) => setInProgressText(event.target.value)}
            onBlur={() => void persist({ closedText, inProgressText, blockedText })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <Label>Bloqué</Label>
          <Textarea
            rows={5}
            value={blockedText}
            onChange={(event) => setBlockedText(event.target.value)}
            onBlur={() => void persist({ closedText, inProgressText, blockedText })}
          />
        </label>

        <FieldError message={saver.error} />

        <p className="text-sub text-muted">
          Enregistrement automatique en sortant d'un champ. Une semaine sans compte rendu reste vide.
        </p>
      </div>
    </Card>
  );
}
