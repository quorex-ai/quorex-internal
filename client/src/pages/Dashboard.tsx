import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CircleCheck,
  CircleDashed,
  Flag,
  Hourglass,
  ListChecks,
  ListTodo,
  SquareKanban,
  Timer,
} from 'lucide-react';
import type { Criterion, Milestone, MilestoneDetail, Task } from '@quorex/shared';
import { PageHeader } from '../components/PageHeader';
import { CriteriaList } from '../components/CriteriaList';
import { Card, CardHeader } from '../components/ui/Card';
import { Cell, Counter, Table } from '../components/ui/Table';
import { LatePill, MilestoneStatusPill, TaskStatusPill } from '../components/ui/Pill';
import { StatsRow } from '../components/ui/StatsRow';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth';
import { useTeam } from '../lib/store';
import { useResource } from '../lib/useApi';
import { daysUntil, formatIsoDate, greeting } from '../lib/format';
import { milestoneColor } from '../lib/colors';

interface TasksResponse {
  tasks: Task[];
}

interface MilestoneDetailResponse {
  milestone: MilestoneDetail;
}

/** Jalon « en cours » : le premier in_progress, sinon le premier non fermé. */
function currentMilestone(milestones: Milestone[]): Milestone | null {
  return (
    milestones.find((milestone) => milestone.status === 'in_progress') ??
    milestones.find((milestone) => milestone.status !== 'closed') ??
    null
  );
}

function nextDeadline(milestones: Milestone[]): Milestone | null {
  return milestones
    .filter((milestone) => milestone.status !== 'closed' && milestone.targetDate !== null)
    .sort((a, b) => (a.targetDate ?? '').localeCompare(b.targetDate ?? ''))[0] ?? null;
}

export function Dashboard(): JSX.Element {
  const { user } = useAuth();
  const { milestones } = useTeam();
  const tasks = useResource<TasksResponse>('/tasks');

  const firstName = user?.displayName.split(' ')[0] ?? '';
  const allTasks = tasks.data?.tasks ?? [];
  const openTasks = allTasks.filter((task) => task.status === 'in_progress');

  const closed = milestones.filter((milestone) => milestone.status === 'closed').length;
  const next = nextDeadline(milestones);
  const daysToNext = next?.targetDate ? daysUntil(next.targetDate) : null;
  const current = currentMilestone(milestones);

  const detail = useResource<MilestoneDetailResponse>(current ? `/milestones/${current.id}` : null);
  const criteria: Criterion[] = detail.data?.milestone.criteria ?? [];

  return (
    <>
      <PageHeader
        title={
          <>
            {greeting()} {firstName},
          </>
        }
        actions={
          <>
            <Link to="/jalons">
              <Button icon={<Flag size={18} strokeWidth={1.75} />}>Jalons</Button>
            </Link>
            <Link to="/taches">
              <Button icon={<SquareKanban size={18} strokeWidth={1.75} />}>Tâches</Button>
            </Link>
          </>
        }
      />

      <StatsRow
        stats={[
          {
            icon: CircleCheck,
            value: `${closed} / ${milestones.length}`,
            label: 'jalons fermés',
          },
          { icon: Hourglass, value: String(openTasks.length), label: 'tâches en cours' },
          {
            icon: Timer,
            value: daysToNext === null ? '—' : String(daysToNext),
            label: daysToNext === null ? 'aucune date cible' : 'jours avant le prochain jalon',
          },
        ]}
      />

      <Card className="mb-6">
        <CardHeader
          icon={ListChecks}
          title="Jalons"
          actions={
            <Link to="/jalons">
              <Button variant="soft">Tout voir</Button>
            </Link>
          }
        />
        <Table
          columns={[
            { icon: Flag, label: 'Jalon' },
            { icon: CalendarClock, label: 'Date cible', width: '260px' },
            { icon: CircleDashed, label: 'Statut', width: '220px' },
          ]}
        >
          {milestones.map((milestone) => (
            <tr key={milestone.id} className="hover:bg-hover">
              <Cell first>
                <div className="flex items-center gap-4">
                  <span
                    className="h-6 w-6 shrink-0 rounded-lg"
                    style={{ backgroundColor: milestoneColor(milestone.id) }}
                    aria-hidden="true"
                  />
                  <Link to="/jalons" className="min-w-0 flex-1 truncate hover:underline">
                    {milestone.title}
                  </Link>
                  <span className="flex shrink-0 items-center gap-4">
                    <Counter icon={ListChecks} value={`${milestone.criteriaChecked}/${milestone.criteriaTotal}`} />
                    <Counter icon={ListTodo} value={milestone.tasksOpen} />
                  </span>
                </div>
              </Cell>
              <Cell>
                <span className="flex items-center gap-3 whitespace-nowrap">
                  {milestone.targetDate ? formatIsoDate(milestone.targetDate) : '—'}
                  {milestone.late && <LatePill />}
                </span>
              </Cell>
              <Cell>
                <MilestoneStatusPill status={milestone.status} />
              </Cell>
            </tr>
          ))}
          {milestones.length === 0 && (
            <tr>
              <Cell first className="text-muted">
                Aucun jalon. Lancer <code>npm run seed:milestones</code> pour créer les sept jalons.
              </Cell>
              <Cell />
              <Cell />
            </tr>
          )}
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[55fr_45fr]">
        <Card>
          <CardHeader
            icon={SquareKanban}
            title="Tâches en cours"
            actions={
              <Link to="/taches">
                <Button variant="soft">Tout voir</Button>
              </Link>
            }
          />
          <div className="border-t border-card-line px-8 py-2">
            {openTasks.length === 0 && (
              <p className="py-6 text-body text-muted">Aucune tâche en cours pour l'instant.</p>
            )}
            <ul>
              {openTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-4 border-b border-card-line py-5 last:border-b-0">
                  <span
                    className="h-10 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: milestoneColor(task.milestoneId) }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-ink">{task.title}</p>
                    <p className="truncate text-sub text-muted">{task.milestoneTitle}</p>
                  </div>
                  {task.assigneeName && <Avatar name={task.assigneeName} size={28} />}
                  <TaskStatusPill status={task.status} />
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={ListChecks}
            title="Critères d'acceptation"
            meta={
              current && (
                <span className="truncate rounded-full border border-card-line px-4 py-1.5 text-sub text-muted">
                  {current.title}
                </span>
              )
            }
          />
          {current ? (
            <CriteriaList criteria={criteria} />
          ) : (
            <p className="border-t border-card-line px-8 py-6 text-body text-muted">
              Aucun jalon ouvert.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
