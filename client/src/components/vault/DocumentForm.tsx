import { useState, type FormEvent } from 'react';
import { Upload, X } from 'lucide-react';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type DocumentSummary,
  type DocumentType,
  type Folder,
} from '@quorex/shared';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { FieldError, Input, Label, Select } from '../ui/Field';
import { apiFetch } from '../../lib/api';
import { errorMessage } from '../../lib/useApi';
import { useTeam } from '../../lib/store';

export interface MetadataValues {
  title: string;
  type: DocumentType;
  parties: string;
  docDate: string;
  tags: string;
  milestoneId: string;
  folderId: string;
}

function initialValues(document: DocumentSummary | null, file: File | null, folderId: string | null): MetadataValues {
  if (document) {
    return {
      title: document.title,
      type: document.type,
      parties: document.parties,
      docDate: document.docDate ?? '',
      tags: document.tags.join(', '),
      milestoneId: document.milestoneId ?? '',
      folderId: document.folderId ?? '',
    };
  }

  return {
    title: file ? file.name.replace(/\.[^.]+$/, '') : '',
    type: 'other',
    parties: '',
    docDate: '',
    tags: '',
    milestoneId: '',
    folderId: folderId ?? '',
  };
}

interface DocumentFormProps {
  /** Dépôt d'un nouveau fichier, ou édition d'un document déjà déposé. */
  file?: File;
  document?: DocumentSummary;
  folders: Folder[];
  currentFolderId: string | null;
  onCancel: () => void;
  onDone: (message: string) => Promise<void>;
}

export function DocumentForm({
  file,
  document,
  folders,
  currentFolderId,
  onCancel,
  onDone,
}: DocumentFormProps): JSX.Element {
  const { milestones } = useTeam();
  const [values, setValues] = useState<MetadataValues>(
    initialValues(document ?? null, file ?? null, currentFolderId),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof MetadataValues>(key: K, value: MetadataValues[K]): void =>
    setValues((current) => ({ ...current, [key]: value }));

  const tags = (): string[] =>
    values.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (document) {
        await apiFetch(`/documents/${document.id}`, {
          method: 'PATCH',
          body: {
            title: values.title,
            type: values.type,
            parties: values.parties,
            docDate: values.docDate === '' ? null : values.docDate,
            tags: tags(),
            milestoneId: values.milestoneId === '' ? null : values.milestoneId,
            folderId: values.folderId === '' ? null : values.folderId,
          },
        });
        await onDone('Document mis à jour.');
        return;
      }

      // Envoi multipart : le fichier part tel quel, le serveur verifie son contenu.
      const form = new FormData();
      form.append('file', file as File);
      form.append('title', values.title);
      form.append('type', values.type);
      form.append('parties', values.parties);
      form.append('docDate', values.docDate);
      form.append('tags', JSON.stringify(tags()));
      form.append('milestoneId', values.milestoneId);
      form.append('folderId', values.folderId);

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: form,
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error: { message?: string } }).error.message ?? 'Dépôt refusé.')
            : 'Dépôt refusé.';
        throw new Error(message);
      }

      await onDone('Document déposé.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader
        icon={Upload}
        title={document ? 'Modifier le document' : 'Métadonnées du document'}
        meta={
          <span className="truncate text-sub text-muted">
            {document ? document.originalFilename : (file?.name ?? '')}
          </span>
        }
        actions={
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="rounded-lg p-2 text-muted hover:bg-hover hover:text-ink"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        }
      />
      <form className="border-t border-card-line px-8 py-6" onSubmit={(event) => void submit(event)}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-2">
            <Label>Titre</Label>
            <Input
              required
              value={values.title}
              maxLength={300}
              onChange={(event) => set('title', event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={values.type} onChange={(event) => set('type', event.target.value as DocumentType)}>
              {DOCUMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {DOCUMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-2">
            <Label>Dossier</Label>
            <Select value={values.folderId} onChange={(event) => set('folderId', event.target.value)}>
              <option value="">Racine du coffre</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.path}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-2">
            <Label>Parties</Label>
            <Input
              value={values.parties}
              maxLength={500}
              onChange={(event) => set('parties', event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <Label>Date du document</Label>
            <Input type="date" value={values.docDate} onChange={(event) => set('docDate', event.target.value)} />
          </label>
          <label className="flex flex-col gap-2">
            <Label>Tags (séparés par des virgules)</Label>
            <Input
              value={values.tags}
              placeholder="contrat, acme"
              onChange={(event) => set('tags', event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <Label>Jalon</Label>
            <Select value={values.milestoneId} onChange={(event) => set('milestoneId', event.target.value)}>
              <option value="">Aucun</option>
              {milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button variant="primary" type="submit" disabled={busy}>
            {document ? 'Enregistrer' : 'Déposer'}
          </Button>
          <Button onClick={onCancel}>Annuler</Button>
        </div>

        <div className="mt-4">
          <FieldError message={error} />
        </div>
      </form>
    </Card>
  );
}
