import { useEffect, useState, type DragEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  CircleDashed,
  ExternalLink,
  Flag,
  GripVertical,
  ListChecks,
  ListTodo,
  Plus,
} from 'lucide-react';
import {
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABELS,
  type Milestone,
  type MilestoneDetail,
  type MilestoneStatus,
} from '@quorex/shared';
import { PageHeader } from '../components/PageHeader';
import { CriteriaList } from '../components/CriteriaList';
import { Card, CardHeader } from '../components/ui/Card';
import { Cell, Counter, Table } from '../components/ui/Table';
import { LatePill, MilestoneStatusPill, TaskStatusPill } from '../components/ui/Pill';
import { Button } from '../components/ui/Button';
import { FieldError, Input, Label, Select, Textarea } from '../components/ui/Field';
import { SaveIndicator } from '../components/ui/SaveIndicator';
import { ApiRequestError, apiFetch } from '../lib/api';
import { useTeam } from '../lib/store';
import { errorMessage, useResource } from '../lib/useApi';
import { useSaver } from '../lib/useSaver';
import { useToast } from '../lib/toast';
import { formatIsoDate } from '../lib/format';
import { milestoneColor } from '../lib/colors';

interface DetailResponse {
  milestone: MilestoneDetail;
}

interface MissingCriterion {
  id: string;
  label: string;
}

/** Détail du 409 de la règle de fermeture, tel que le serveur l'envoie. */
function missingCriteria(caught: unknown): MissingCriterion[] {
  if (!(caught instanceof ApiRequestError) || caught.status !== 409) return [];
  const details = caught.details;
  if (typeof details !== 'object' || details === null || !('missing' in details)) return [];
  const missing = (details as { missing: unknown }).missing;
  return Array.isArray(missing) ? (missing as MissingCriterion[]) : [];
}

export function Milestones(): JSX.Element {
  const { milestones, reloadMilestones } = useTeam();
  const toast = useToast();
  const [parameters, setParameters] = useSearchParams();

  const selectedId = parameters.get('id') ?? milestones[0]?.id ?? null;
  const [order, setOrder] = useState<Milestone[]>(milestones);
  const [dragId, setDragId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    setOrder(milestones);
  }, [milestones]);

  const select = (id: string): void => setParameters({ id }, { replace: true });

  const detail = useResource<DetailResponse>(selectedId ? `/milestones/${selectedId}` : null);

  const reorder = async (targetId: string, carried?: string): Promise<void> => {
    const movedId = dragId ?? carried ?? null;
    if (!movedId || movedId === targetId) return;

    const next = [...order];
    const from = next.findIndex((milestone) => milestone.id === movedId);
    const to = next.findIndex((milestone) => milestone.id === targetId);
    if (from < 0 || to < 0) return;

    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setOrder(next);
    setDragId(null);

    try {
      await apiFetch('/milestones/reorder', {
        method: 'POST',
        body: { ids: next.map((milestone) => milestone.id) },
      });
      await reloadMilestones();
      toast.success('Ordre des jalons enregistré.');
    } catch (caught) {
      setListError(errorMessage(caught));
      setOrder(milestones);
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (newTitle.trim().length === 0) return;

    setListError(null);
    try {
      const result = await apiFetch<{ milestone: Milestone }>('/milestones', {
        method: 'POST',
        body: { title: newTitle },
      });
      setNewTitle('');
      setCreating(false);
      await reloadMilestones();
      select(result.milestone.id);
      toast.success('Jalon créé.');
    } catch (caught) {
      setListError(errorMessage(caught));
    }
  };

  return (
    <>
      <PageHeader
        title="Jalons"
        actions={
          <Button
            variant="primary"
            icon={<Plus size={18} strokeWidth={2} />}
            onClick={() => setCreating((value) => !value)}
          >
            Nouveau jalon
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader
          icon={Flag}
          title="Les jalons"
          meta={<span className="text-sub text-muted">Glisser une ligne pour réordonner</span>}
        />

        {creating && (
          <form className="flex gap-3 border-t border-card-line px-8 py-5" onSubmit={(event) => void create(event)}>
            <Input
              autoFocus
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Titre du jalon"
              maxLength={200}
            />
            <Button variant="primary" type="submit" icon={<Plus size={18} strokeWidth={2} />}>
              Créer
            </Button>
          </form>
        )}

        <Table
          columns={[
            { icon: Flag, label: 'Jalon' },
            { icon: CalendarClock, label: 'Date cible', width: '250px' },
            { icon: CircleDashed, label: 'Statut', width: '200px' },
          ]}
        >
          {order.map((milestone) => (
            <tr
              key={milestone.id}
              draggable
              onDragStart={(event: DragEvent<HTMLTableRowElement>) => {
                setDragId(milestone.id);
                event.dataTransfer.setData('text/plain', milestone.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event: DragEvent<HTMLTableRowElement>) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event: DragEvent<HTMLTableRowElement>) =>
                void reorder(milestone.id, event.dataTransfer.getData('text/plain'))
              }
              onClick={() => select(milestone.id)}
              className={[
                'cursor-pointer transition-colors hover:bg-hover',
                selectedId === milestone.id ? 'bg-hover' : '',
                dragId === milestone.id ? 'opacity-50' : '',
              ].join(' ')}
            >
              <Cell first>
                <div className="flex items-center gap-3">
                  <GripVertical size={18} className="shrink-0 cursor-grab text-muted" aria-hidden="true" />
                  <span
                    className="h-6 w-6 shrink-0 rounded-lg"
                    style={{ backgroundColor: milestoneColor(milestone.id) }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{milestone.title}</span>
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
        </Table>

        {listError && (
          <div className="px-8 py-5">
            <FieldError message={listError} />
          </div>
        )}
      </Card>

      {detail.data && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[55fr_45fr]">
          <MilestoneForm
            milestone={detail.data.milestone}
            onSaved={async () => {
              await Promise.all([detail.reload(), reloadMilestones()]);
            }}
          />

          <Card>
            <CardHeader icon={ListChecks} title="Critères d'acceptation" />
            <CriteriaList
              criteria={detail.data.milestone.criteria}
              milestoneId={detail.data.milestone.id}
              onChanged={() => {
                void detail.reload();
                void reloadMilestones();
              }}
            />
          </Card>
        </div>
      )}
    </>
  );
}

interface MilestoneFormProps {
  milestone: MilestoneDetail;
  onSaved: () => Promise<void>;
}

/**
 * Fiche du jalon : chaque champ s'enregistre en sortant, sans bouton a chercher.
 * Le statut est le seul cas qui peut etre refuse (regle de fermeture) : il revient
 * alors a sa valeur precedente, avec la liste de ce qui manque.
 */
function MilestoneForm({ milestone, onSaved }: MilestoneFormProps): JSX.Element {
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description);
  const [targetDate, setTargetDate] = useState(milestone.targetDate ?? '');
  const [status, setStatus] = useState<MilestoneStatus>(milestone.status);
  const [blocked, setBlocked] = useState<MissingCriterion[]>([]);
  const saver = useSaver();

  useEffect(() => {
    setTitle(milestone.title);
    setDescription(milestone.description);
    setTargetDate(milestone.targetDate ?? '');
    setStatus(milestone.status);
    setBlocked([]);
  }, [milestone]);

  const persist = async (patch: Record<string, unknown>): Promise<void> => {
    setBlocked([]);
    const ok = await saver.save(async () => {
      try {
        await apiFetch(`/milestones/${milestone.id}`, { method: 'PATCH', body: patch });
      } catch (caught) {
        setBlocked(missingCriteria(caught));
        throw caught;
      }
    });

    if (ok) await onSaved();
    else if ('status' in patch) setStatus(milestone.status);
  };

  const unchecked = milestone.criteria.filter((criterion) => !criterion.checked);

  return (
    <Card>
      <CardHeader
        icon={Flag}
        title="Fiche du jalon"
        meta={<SaveIndicator status={saver.status} />}
        actions={<span className="text-sub text-muted">Enregistrement automatique</span>}
      />
      <div className="flex flex-col gap-5 border-t border-card-line px-8 py-6">
        <label className="flex flex-col gap-2">
          <Label>Titre</Label>
          <Input
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              if (title !== milestone.title) void persist({ title });
            }}
          />
        </label>

        <label className="flex flex-col gap-2">
          <Label>Description</Label>
          <Textarea
            rows={4}
            value={description}
            maxLength={4000}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => {
              if (description !== milestone.description) void persist({ description });
            }}
          />
        </label>

        <div className="grid grid-cols-2 gap-5">
          <label className="flex flex-col gap-2">
            <Label>Date cible</Label>
            <Input
              type="date"
              value={targetDate}
              onChange={(event) => {
                const value = event.target.value;
                setTargetDate(value);
                void persist({ targetDate: value === '' ? null : value });
              }}
            />
          </label>

          <label className="flex flex-col gap-2">
            <Label>Statut</Label>
            <Select
              value={status}
              onChange={(event) => {
                const value = event.target.value as MilestoneStatus;
                setStatus(value);
                void persist({ status: value });
              }}
            >
              {MILESTONE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {MILESTONE_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {status !== 'closed' && unchecked.length > 0 && (
          <p className="rounded-[10px] bg-field px-4 py-3 text-sub text-muted">
            {unchecked.length} critère(s) à cocher avant de pouvoir fermer ce jalon.
          </p>
        )}

        <FieldError message={saver.error} />

        {blocked.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-[10px] bg-field px-4 py-3 text-sub text-ink-soft">
            {blocked.map((criterion) => (
              <li key={criterion.id}>• {criterion.label}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-card-line px-8 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-body font-medium text-ink">Tâches liées</h3>
          <Link to={`/taches?milestone=${milestone.id}`} className="text-sub text-muted hover:text-ink">
            Ouvrir dans le kanban
          </Link>
        </div>
        {milestone.tasks.length === 0 ? (
          <p className="text-sub text-muted">Aucune tâche rattachée à ce jalon.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {milestone.tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-body text-ink">{task.title}</span>
                {task.externalUrl && (
                  <a
                    href={task.externalUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted hover:text-brand"
                    aria-label="Ouvrir le lien externe"
                  >
                    <ExternalLink size={16} strokeWidth={1.75} />
                  </a>
                )}
                <TaskStatusPill status={task.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
