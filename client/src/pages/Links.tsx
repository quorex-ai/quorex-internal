import { useEffect, useState, type DragEvent, type FormEvent } from 'react';
import { ExternalLink, GripVertical, Link2, Plus, Trash2 } from 'lucide-react';
import type { Link } from '@quorex/shared';
import { PageHeader } from '../components/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FieldError, Input } from '../components/ui/Field';
import { SaveIndicator } from '../components/ui/SaveIndicator';
import { apiFetch } from '../lib/api';
import { errorMessage, useResource } from '../lib/useApi';
import { useSaver } from '../lib/useSaver';
import { useToast } from '../lib/toast';

interface LinksResponse {
  links: Link[];
}

export function Links(): JSX.Element {
  const resource = useResource<LinksResponse>('/links');
  const saver = useSaver();
  const toast = useToast();
  const [order, setOrder] = useState<Link[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    setOrder(resource.data?.links ?? []);
  }, [resource.data]);

  const apply = (links: Link[]): void => setOrder(links);

  // Enregistrement a la sortie du champ : pas de bouton a chercher.
  const save = async (link: Link, values: { label?: string; url?: string }): Promise<void> => {
    setError(null);
    await saver.save(async () => {
      const result = await apiFetch<LinksResponse>(`/links/${link.id}`, { method: 'PATCH', body: values });
      apply(result.links);
    });
  };

  const remove = async (link: Link): Promise<void> => {
    setError(null);
    try {
      const result = await apiFetch<LinksResponse>(`/links/${link.id}`, { method: 'DELETE' });
      apply(result.links);
      toast.success('Lien supprimé.');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (newLabel.trim().length === 0) return;

    setError(null);
    try {
      const result = await apiFetch<LinksResponse>('/links', { method: 'POST', body: { label: newLabel } });
      apply(result.links);
      setNewLabel('');
      toast.success('Lien ajouté.');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const reorder = async (targetId: string, carried?: string): Promise<void> => {
    const movedId = dragId ?? carried ?? null;
    if (!movedId || movedId === targetId) return;

    const next = [...order];
    const from = next.findIndex((link) => link.id === movedId);
    const to = next.findIndex((link) => link.id === targetId);
    if (from < 0 || to < 0) return;

    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setOrder(next);
    setDragId(null);

    try {
      const result = await apiFetch<LinksResponse>('/links/reorder', {
        method: 'POST',
        body: { ids: next.map((link) => link.id) },
      });
      apply(result.links);
    } catch (caught) {
      setError(errorMessage(caught));
      await resource.reload();
    }
  };

  return (
    <>
      <PageHeader title="Liens" />

      <Card>
        <CardHeader
          icon={Link2}
          title="Liens de travail"
          meta={<SaveIndicator status={saver.status} />}
          actions={<span className="text-sub text-muted">Glisser pour réordonner · enregistrement automatique</span>}
        />

        <ul className="border-t border-card-line">
          {order.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              dragging={dragId === link.id}
              onDragStart={(event) => {
                setDragId(link.id);
                event.dataTransfer.setData('text/plain', link.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDrop={(event) => void reorder(link.id, event.dataTransfer.getData('text/plain'))}
              onSave={(values) => void save(link, values)}
              onRemove={() => void remove(link)}
            />
          ))}
          {order.length === 0 && <li className="px-8 py-6 text-body text-muted">Aucun lien.</li>}
        </ul>

        <form className="flex gap-3 border-t border-card-line px-8 py-5" onSubmit={(event) => void create(event)}>
          <Input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Libellé du nouveau lien"
            maxLength={200}
          />
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
    </>
  );
}

interface LinkRowProps {
  link: Link;
  dragging: boolean;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
  onSave: (values: { label?: string; url?: string }) => void;
  onRemove: () => void;
}

function LinkRow({ link, dragging, onDragStart, onDrop, onSave, onRemove }: LinkRowProps): JSX.Element {
  const [label, setLabel] = useState(link.label);
  const [url, setUrl] = useState(link.url);

  useEffect(() => {
    setLabel(link.label);
    setUrl(link.url);
  }, [link]);

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={(event: DragEvent<HTMLLIElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={onDrop}
      className={[
        'flex items-center gap-4 border-b border-card-line px-8 py-4 last:border-b-0',
        dragging ? 'opacity-50' : '',
      ].join(' ')}
    >
      <GripVertical size={18} className="shrink-0 cursor-grab text-muted" aria-hidden="true" />

      <div className="w-[260px] shrink-0">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => {
            if (label !== link.label && label.trim().length > 0) onSave({ label });
          }}
          maxLength={200}
        />
      </div>

      <div className="min-w-0 flex-1">
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onBlur={() => {
            if (url !== link.url) onSave({ url });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          placeholder="https://…"
          maxLength={2000}
        />
      </div>

      {link.url ? (
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Ouvrir le lien"
          className="rounded-lg p-2 text-muted hover:bg-hover hover:text-brand"
        >
          <ExternalLink size={16} strokeWidth={1.75} />
        </a>
      ) : (
        <span className="w-9" aria-hidden="true" />
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label="Supprimer le lien"
        className="rounded-lg p-2 text-muted hover:bg-hover hover:text-ink"
      >
        <Trash2 size={16} strokeWidth={1.75} />
      </button>
    </li>
  );
}
