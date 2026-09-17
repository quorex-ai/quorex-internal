import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ExternalLink, Pencil, Plus, SquareKanban, Trash2 } from 'lucide-react';
import { TASK_STATUSES, TASK_STATUS_LABELS, type Task, type TaskStatus } from '@quorex/shared';
import { PageHeader } from '../components/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { FieldError, Input, PillSelect, Select } from '../components/ui/Field';
import { SaveIndicator } from '../components/ui/SaveIndicator';
import { apiFetch } from '../lib/api';
import { useTeam } from '../lib/store';
import { errorMessage, useResource } from '../lib/useApi';
import { useSaver } from '../lib/useSaver';
import { useToast } from '../lib/toast';
import { milestoneColor } from '../lib/colors';

interface TasksResponse {
  tasks: Task[];
}

export function Tasks(): JSX.Element {
  const { milestones, users, reloadMilestones } = useTeam();
  const tasks = useResource<TasksResponse>('/tasks');
  const toast = useToast();
  const [parameters, setParameters] = useSearchParams();

  const milestoneFilter = parameters.get('milestone') ?? '';
  const highlighted = parameters.get('task');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newMilestone, setNewMilestone] = useState('');

  const all = tasks.data?.tasks ?? [];

  const visible = useMemo(
    () =>
      all.filter(
        (task) =>
          (milestoneFilter === '' || task.milestoneId === milestoneFilter) &&
          (assigneeFilter === '' ||
            (assigneeFilter === 'none' ? task.assigneeId === null : task.assigneeId === assigneeFilter)),
      ),
    [all, milestoneFilter, assigneeFilter],
  );

  const columns = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], review: [], done: [] };
    for (const task of visible) grouped[task.status].push(task);
    return grouped;
  }, [visible]);

  const refresh = async (): Promise<void> => {
    await Promise.all([tasks.reload(), reloadMilestones()]);
  };

  const setFilter = (milestoneId: string): void => {
    const next = new URLSearchParams(parameters);
    if (milestoneId) next.set('milestone', milestoneId);
    else next.delete('milestone');
    next.delete('task');
    setParameters(next, { replace: true });
  };

  const drop = async (status: TaskStatus, beforeId: string | null, carried?: string): Promise<void> => {
    const movedId = dragId ?? carried ?? null;
    if (!movedId) return;
    const moved = all.find((task) => task.id === movedId);
    setDragId(null);
    if (!moved) return;

    // Ordre complet de la colonne d'arrivee, tache deplacee inseree a sa place.
    const target = all.filter((task) => task.status === status && task.id !== moved.id);
    const index = beforeId === null ? target.length : target.findIndex((task) => task.id === beforeId);
    target.splice(index < 0 ? target.length : index, 0, moved);

    setError(null);
    try {
      await apiFetch('/tasks/move', {
        method: 'POST',
        body: { status, ids: target.map((task) => task.id) },
      });
      await refresh();
      if (moved.status !== status) {
        toast.success(`« ${moved.title} » → ${TASK_STATUS_LABELS[status]}.`);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (newTitle.trim().length === 0 || newMilestone === '') return;

    setError(null);
    try {
      await apiFetch('/tasks', {
        method: 'POST',
        body: { title: newTitle, milestoneId: newMilestone },
      });
      setNewTitle('');
      await refresh();
      toast.success('Tâche créée.');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const remove = async (task: Task): Promise<void> => {
    setError(null);
    try {
      await apiFetch(`/tasks/${task.id}`, { method: 'DELETE' });
      await refresh();
      toast.success('Tâche supprimée.');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <>
      <PageHeader
        title="Tâches"
        actions={
          <>
            <PillSelect value={milestoneFilter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">Tous les jalons</option>
              {milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </PillSelect>
            <PillSelect value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
              <option value="">Tout le monde</option>
              {users.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
              <option value="none">Non assignée</option>
            </PillSelect>
          </>
        }
      />

      <Card className="mb-6">
        <CardHeader icon={SquareKanban} title="Création rapide" />
        <form
          className="flex flex-wrap items-center gap-3 border-t border-card-line px-8 py-5"
          onSubmit={(event) => void create(event)}
        >
          <div className="min-w-[240px] flex-1">
            <Input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Titre de la tâche"
              maxLength={300}
            />
          </div>
          <div className="w-[320px]">
            <Select value={newMilestone} onChange={(event) => setNewMilestone(event.target.value)}>
              <option value="">Choisir un jalon…</option>
              {milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="primary" type="submit" icon={<Plus size={18} strokeWidth={2} />}>
            Ajouter
          </Button>
        </form>
        {error && (
          <div className="px-8 pb-5">
            <FieldError message={error} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-4">
        {TASK_STATUSES.map((status) => (
          <section
            key={status}
            onDragOver={(event: DragEvent<HTMLElement>) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event: DragEvent<HTMLElement>) =>
              void drop(status, null, event.dataTransfer.getData('text/plain'))
            }
            className="flex flex-col rounded-card border border-card-line bg-card"
          >
            <header className="flex items-center justify-between border-b border-card-line px-6 py-5">
              <h2 className="text-card font-semibold text-ink">{TASK_STATUS_LABELS[status]}</h2>
              <span className="rounded-full bg-field px-3 py-1 text-sub text-muted">
                {columns[status].length}
              </span>
            </header>

            <ul className="flex min-h-[160px] flex-col gap-3 p-4">
              {columns[status].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  editing={editingId === task.id}
                  highlighted={highlighted === task.id}
                  dragging={dragId === task.id}
                  onEdit={() => setEditingId(editingId === task.id ? null : task.id)}
                  onDragStart={(event) => {
                    setDragId(task.id);
                    event.dataTransfer.setData('text/plain', task.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDrop={(event) => {
                    event.stopPropagation();
                    void drop(status, task.id, event.dataTransfer.getData('text/plain'));
                  }}
                  onRemove={() => void remove(task)}
                  onSaved={refresh}
                />
              ))}

              {columns[status].length === 0 && (
                <li className="rounded-item border border-dashed border-card-line px-4 py-6 text-center text-sub text-muted">
                  Déposer une tâche ici
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

interface TaskCardProps {
  task: Task;
  editing: boolean;
  highlighted: boolean;
  dragging: boolean;
  onEdit: () => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
  onRemove: () => void;
  onSaved: () => Promise<void>;
}

/** Carte du kanban : lecture par defaut, edition sur place au crayon. */
function TaskCard({
  task,
  editing,
  highlighted,
  dragging,
  onEdit,
  onDragStart,
  onDrop,
  onRemove,
  onSaved,
}: TaskCardProps): JSX.Element {
  const { milestones, users } = useTeam();
  const saver = useSaver();
  const card = useRef<HTMLLIElement>(null);

  const [title, setTitle] = useState(task.title);
  const [externalUrl, setExternalUrl] = useState(task.externalUrl ?? '');

  useEffect(() => {
    setTitle(task.title);
    setExternalUrl(task.externalUrl ?? '');
  }, [task]);

  useEffect(() => {
    if (highlighted) card.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlighted]);

  const persist = async (patch: Record<string, unknown>): Promise<void> => {
    const ok = await saver.save(() => apiFetch(`/tasks/${task.id}`, { method: 'PATCH', body: patch }));
    if (ok) await onSaved();
  };

  return (
    <li
      ref={card}
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={(event: DragEvent<HTMLLIElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={onDrop}
      className={[
        'group rounded-item border bg-card p-4 transition-colors',
        editing ? 'border-brand' : 'cursor-grab border-card-line hover:border-muted',
        highlighted ? 'border-brand ring-2 ring-brand/30' : '',
        dragging ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-1 h-8 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: milestoneColor(task.milestoneId) }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              autoFocus
              value={title}
              maxLength={300}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                if (title.trim() !== task.title && title.trim().length > 0) void persist({ title });
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
          ) : (
            <p className="text-body font-medium text-ink">{task.title}</p>
          )}
          <p className="mt-1 truncate text-sub text-muted">{task.milestoneTitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={editing ? "Terminer l'édition" : 'Modifier la tâche'}
            className={[
              'rounded-lg p-1 transition',
              editing
                ? 'text-brand'
                : 'text-muted opacity-0 hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100',
            ].join(' ')}
          >
            {editing ? <Check size={16} strokeWidth={2} /> : <Pencil size={16} strokeWidth={1.75} />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Supprimer la tâche"
            className="rounded-lg p-1 text-muted opacity-0 transition hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 flex flex-col gap-3">
          <Input
            value={externalUrl}
            placeholder="Lien PR ou issue (https://…)"
            maxLength={2000}
            onChange={(event) => setExternalUrl(event.target.value)}
            onBlur={() => {
              const value = externalUrl.trim();
              if (value !== (task.externalUrl ?? '')) {
                void persist({ externalUrl: value === '' ? null : value });
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <Select value={task.milestoneId} onChange={(event) => void persist({ milestoneId: event.target.value })}>
            {milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.title}
              </option>
            ))}
          </Select>
          <FieldError message={saver.error} />
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        {task.assigneeName ? (
          <Avatar name={task.assigneeName} size={28} />
        ) : (
          <span className="h-7 w-7 rounded-full border border-dashed border-card-line" aria-hidden="true" />
        )}
        <select
          value={task.assigneeId ?? ''}
          onChange={(event) => void persist({ assigneeId: event.target.value === '' ? null : event.target.value })}
          aria-label="Assigner la tâche"
          className="min-w-0 flex-1 rounded-lg bg-transparent text-sub text-muted focus:outline-none"
        >
          <option value="">Non assignée</option>
          {users.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </select>
        <SaveIndicator status={saver.status} />
        {task.externalUrl && (
          <a
            href={task.externalUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Ouvrir le lien externe"
            className="text-muted hover:text-brand"
          >
            <ExternalLink size={16} strokeWidth={1.75} />
          </a>
        )}
      </div>
    </li>
  );
}
