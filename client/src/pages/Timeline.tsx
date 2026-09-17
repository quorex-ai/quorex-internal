import { ChartNoAxesGantt } from 'lucide-react';
import type { Milestone } from '@quorex/shared';
import { PageHeader } from '../components/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { LatePill, MilestoneStatusPill } from '../components/ui/Pill';
import { useTeam } from '../lib/store';
import { formatIsoDate, parseIsoDate, todayIso } from '../lib/format';
import { milestoneColor } from '../lib/colors';

interface Placed {
  milestone: Milestone;
  /** Position sur l'axe, en pourcentage. */
  offset: number;
  /** Etiquette au-dessus ou en dessous de l'axe, pour ne pas se chevaucher. */
  above: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
const LABEL_WIDTH = 210;

/** Decalage horizontal de l'etiquette pour qu'elle ne deborde pas de la carte. */
function labelShift(offset: number): string {
  if (offset < 12) return '0px';
  if (offset > 88) return `-${LABEL_WIDTH}px`;
  return `-${LABEL_WIDTH / 2}px`;
}

/** Position du trait vertical : sous le point de l'axe, quel que soit le decalage. */
function negate(shift: string): string {
  return shift.startsWith('-') ? shift.slice(1) : `-${shift}`;
}

function place(milestones: Milestone[]): { placed: Placed[]; todayOffset: number; span: string } {
  const dated = milestones.filter((milestone) => milestone.targetDate !== null);
  const today = parseIsoDate(todayIso()).getTime();

  const times = dated.map((milestone) => parseIsoDate(milestone.targetDate!).getTime());
  const min = Math.min(today, ...times);
  const max = Math.max(today, ...times);

  // Marge de 7 jours de chaque cote pour que rien ne colle au bord.
  const from = min - 7 * DAY;
  const to = max + 7 * DAY;
  const range = Math.max(to - from, DAY);

  const placed = dated.map((milestone, index) => ({
    milestone,
    offset: ((parseIsoDate(milestone.targetDate!).getTime() - from) / range) * 100,
    above: index % 2 === 0,
  }));

  return {
    placed,
    todayOffset: ((today - from) / range) * 100,
    span: `${formatIsoDate(todayIso(new Date(from)))} — ${formatIsoDate(todayIso(new Date(to)))}`,
  };
}

export function Timeline(): JSX.Element {
  const { milestones } = useTeam();
  const dated = milestones.filter((milestone) => milestone.targetDate !== null);
  const undated = milestones.filter((milestone) => milestone.targetDate === null);
  const { placed, todayOffset, span } = place(milestones);

  return (
    <>
      <PageHeader title="Frise" />

      <Card className="mb-6">
        <CardHeader
          icon={ChartNoAxesGantt}
          title="Les jalons dans le temps"
          meta={
            dated.length > 0 ? (
              <span className="rounded-full border border-card-line px-4 py-1.5 text-sub text-muted">{span}</span>
            ) : undefined
          }
        />

        <div className="border-t border-card-line px-8 py-10">
          {dated.length === 0 ? (
            <p className="text-body text-muted">
              Aucun jalon n'a de date cible : la frise se remplit dès qu'une date est posée.
            </p>
          ) : (
            <div className="relative h-[280px]">
              {/* Axe unique, pas de Gantt, pas de dependances. */}
              <div className="absolute left-0 right-0 top-1/2 h-px bg-card-line" aria-hidden="true" />

              <div
                className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${todayOffset}%` }}
              >
                <span className="block h-4 w-4 rounded-full border-2 border-card bg-brand" aria-hidden="true" />
                <span className="absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap text-cap font-medium text-brand">
                  aujourd'hui
                </span>
              </div>

              {placed.map(({ milestone, offset, above }) => (
                <div
                  key={milestone.id}
                  className="absolute"
                  style={{
                    left: `${offset}%`,
                    top: above ? '12%' : '58%',
                    // Les etiquettes des extremites restent dans la carte.
                    transform: `translateX(${labelShift(offset)})`,
                  }}
                >
                  <div
                    className={[
                      'w-[210px] rounded-item border border-card-line bg-card p-3',
                      above ? '' : 'mt-10',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-4 w-4 shrink-0 rounded"
                        style={{ backgroundColor: milestoneColor(milestone.id) }}
                        aria-hidden="true"
                      />
                      <p className="min-w-0 flex-1 truncate text-sub font-medium text-ink" title={milestone.title}>
                        {milestone.title}
                      </p>
                    </div>
                    <p className="mt-2 text-cap text-muted">{formatIsoDate(milestone.targetDate!)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <MilestoneStatusPill status={milestone.status} />
                      {milestone.late && <LatePill />}
                    </div>
                  </div>

                  <span
                    className={['absolute w-px bg-card-line', above ? 'top-full h-10' : 'bottom-full h-10'].join(
                      ' ',
                    )}
                    style={{ left: `calc(${negate(labelShift(offset))} + 0px)` }}
                    aria-hidden="true"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {undated.length > 0 && (
        <Card>
          <CardHeader
            icon={ChartNoAxesGantt}
            title="Sans date cible"
            meta={<span className="text-sub text-muted">{undated.length} jalon(s)</span>}
          />
          <ul className="border-t border-card-line px-8 py-4">
            {undated.map((milestone) => (
              <li key={milestone.id} className="flex items-center gap-4 border-b border-card-line py-4 last:border-b-0">
                <span
                  className="h-5 w-5 shrink-0 rounded-lg"
                  style={{ backgroundColor: milestoneColor(milestone.id) }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-body text-ink">{milestone.title}</span>
                <MilestoneStatusPill status={milestone.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
