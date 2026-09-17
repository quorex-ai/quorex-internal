import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Archive,
  CalendarClock,
  Download,
  FileText,
  FolderPlus,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  MAX_DOCUMENT_BYTES,
  type DocumentSummary,
  type Folder,
} from '@quorex/shared';
import { PageHeader } from '../components/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Cell, Table } from '../components/ui/Table';
import { Pill } from '../components/ui/Pill';
import { Button } from '../components/ui/Button';
import { FieldError, Input, Label, PillSelect, Select } from '../components/ui/Field';
import { FolderGrid } from '../components/vault/FolderGrid';
import { DocumentForm } from '../components/vault/DocumentForm';
import { apiFetch } from '../lib/api';
import { useTeam } from '../lib/store';
import { errorMessage, useResource } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { formatIsoDate } from '../lib/format';

interface DocumentsResponse {
  documents: DocumentSummary[];
  tags: string[];
}

interface FoldersResponse {
  folders: Folder[];
}

type GroupBy = 'folder' | 'type' | 'milestone' | 'tag';

const GROUP_LABELS: Record<GroupBy, string> = {
  folder: 'Dossiers',
  type: 'Type',
  milestone: 'Jalon',
  tag: 'Tag',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

/** Sections du mode « regrouper par » : un document peut tomber dans plusieurs groupes (tags). */
function group(documents: DocumentSummary[], by: Exclude<GroupBy, 'folder'>): [string, DocumentSummary[]][] {
  const sections = new Map<string, DocumentSummary[]>();

  const push = (key: string, document: DocumentSummary): void => {
    const existing = sections.get(key);
    if (existing) existing.push(document);
    else sections.set(key, [document]);
  };

  for (const document of documents) {
    if (by === 'type') push(DOCUMENT_TYPE_LABELS[document.type], document);
    else if (by === 'milestone') push(document.milestoneTitle ?? 'Sans jalon', document);
    else if (document.tags.length === 0) push('Sans tag', document);
    else for (const tag of document.tags) push(tag, document);
  }

  return [...sections.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
}

export function Vault(): JSX.Element {
  const { milestones } = useTeam();
  const toast = useToast();
  const [parameters, setParameters] = useSearchParams();

  const [groupBy, setGroupBy] = useState<GroupBy>('folder');
  const [type, setType] = useState('');
  const [tag, setTag] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const folderId = parameters.get('folder');
  const highlighted = parameters.get('document');

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<DocumentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Des qu'un filtre est pose, on cherche dans tout le coffre, dossiers confondus.
  const filtering = search.trim() !== '' || type !== '' || tag !== '' || milestoneId !== '' || from !== '' || to !== '';
  const browsingFolders = groupBy === 'folder' && !filtering;

  const query = useMemo(() => {
    const search_ = new URLSearchParams();
    if (browsingFolders) search_.set('folderId', folderId ?? 'root');
    if (type) search_.set('type', type);
    if (tag) search_.set('tag', tag);
    if (milestoneId) search_.set('milestoneId', milestoneId);
    if (from) search_.set('from', from);
    if (to) search_.set('to', to);
    if (search.trim()) search_.set('search', search.trim());
    const suffix = search_.toString();
    return suffix ? `/documents?${suffix}` : '/documents';
  }, [browsingFolders, folderId, type, tag, milestoneId, from, to, search]);

  const documents = useResource<DocumentsResponse>(query);
  const foldersResource = useResource<FoldersResponse>('/folders');

  const rows = documents.data?.documents ?? [];
  const tags = documents.data?.tags ?? [];
  const folders = foldersResource.data?.folders ?? [];

  const clearFilters = (): void => {
    setSearch('');
    setType('');
    setTag('');
    setMilestoneId('');
    setFrom('');
    setTo('');
  };

  const refresh = async (): Promise<void> => {
    await Promise.all([documents.reload(), foldersResource.reload()]);
  };

  const openFolder = (id: string | null): void => {
    const next = new URLSearchParams(parameters);
    if (id) next.set('folder', id);
    else next.delete('folder');
    next.delete('document');
    setParameters(next, { replace: true });
  };

  // Un document ouvert depuis la recherche ⌘K amene dans son dossier.
  useEffect(() => {
    if (!highlighted) return;
    const target = rows.find((document) => document.id === highlighted);
    if (target && target.folderId !== (folderId ?? null) && !filtering) {
      openFolder(target.folderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted, rows]);

  const pick = (file: File | undefined): void => {
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError('Fichier trop volumineux : 25 Mo maximum.');
      return;
    }
    setError(null);
    setEditing(null);
    setPendingFile(file);
  };

  const remove = async (document: DocumentSummary): Promise<void> => {
    setError(null);
    try {
      await apiFetch(`/documents/${document.id}`, { method: 'DELETE' });
      setConfirmId(null);
      await refresh();
      toast.success('Document supprimé.');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const createFolder = async (name: string, parentId: string | null): Promise<void> => {
    setError(null);
    try {
      await apiFetch('/folders', { method: 'POST', body: { name, parentId } });
      await refresh();
      toast.success(`Dossier « ${name} » créé.`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const renameFolder = async (folder: Folder, name: string): Promise<void> => {
    try {
      await apiFetch(`/folders/${folder.id}`, { method: 'PATCH', body: { name } });
      await refresh();
      toast.success('Dossier renommé.');
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const deleteFolder = async (folder: Folder): Promise<void> => {
    try {
      await apiFetch(`/folders/${folder.id}`, { method: 'DELETE' });
      await refresh();
      toast.success('Dossier supprimé.');
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  /** Réception d'un glisser-déposer sur un dossier : document ou sous-dossier. */
  const dropOnFolder = async (targetId: string | null, payload: string): Promise<void> => {
    try {
      if (payload.startsWith('folder:')) {
        const id = payload.slice('folder:'.length);
        if (id === targetId) return;
        await apiFetch(`/folders/${id}`, { method: 'PATCH', body: { parentId: targetId } });
        toast.success('Dossier déplacé.');
      } else {
        await apiFetch(`/documents/${payload}`, { method: 'PATCH', body: { folderId: targetId } });
        toast.success('Document déplacé.');
      }
      await refresh();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const documentRow = (document: DocumentSummary, showPath: boolean): JSX.Element => (
    <tr
      key={document.id}
      draggable
      onDragStart={(event: DragEvent<HTMLTableRowElement>) => {
        event.dataTransfer.setData('text/plain', document.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      className={highlighted === document.id ? 'bg-hover' : 'hover:bg-hover'}
    >
      <Cell first>
        <div className="flex min-w-0 items-center gap-4">
          <FileText size={20} strokeWidth={1.5} className="shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body text-ink">{document.title}</p>
            <p className="truncate text-sub text-muted">
              {[
                showPath ? (document.folderPath || 'Racine du coffre') : '',
                document.parties,
                document.milestoneTitle,
                document.tags.join(', '),
              ]
                .filter(Boolean)
                .join(' · ') || document.originalFilename}
            </p>
          </div>
          <span className="shrink-0 text-sub text-muted">{formatSize(document.sizeBytes)}</span>
        </div>
      </Cell>
      <Cell>
        <span className="whitespace-nowrap">{document.docDate ? formatIsoDate(document.docDate) : '—'}</span>
      </Cell>
      <Cell>
        <Pill label={DOCUMENT_TYPE_LABELS[document.type]} tone="gray" />
      </Cell>
      <Cell>
        <div className="flex items-center gap-2">
          <a
            href={`/api/documents/${document.id}/download`}
            className="inline-flex items-center gap-2 rounded-[10px] bg-field px-3 py-2 text-sub text-ink-soft hover:bg-card-line/60"
          >
            <Download size={16} strokeWidth={1.75} />
            Ouvrir
          </a>
          <button
            type="button"
            onClick={() => {
              setPendingFile(null);
              setEditing(document);
            }}
            aria-label="Modifier le document"
            className="rounded-lg p-2 text-muted hover:bg-hover hover:text-ink"
          >
            <Pencil size={16} strokeWidth={1.75} />
          </button>
          {confirmId === document.id ? (
            <>
              <button
                type="button"
                onClick={() => void remove(document)}
                className="rounded-[10px] bg-pill-pink px-3 py-2 text-sub font-medium text-pill-pink-ink"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                aria-label="Annuler la suppression"
                className="rounded-lg p-2 text-muted hover:bg-hover hover:text-ink"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmId(document.id)}
              aria-label="Supprimer le document"
              className="rounded-lg p-2 text-muted hover:bg-hover hover:text-ink"
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </Cell>
    </tr>
  );

  const columns = [
    { icon: FileText, label: 'Document' },
    { icon: CalendarClock, label: 'Date', width: '190px' },
    { icon: Archive, label: 'Type', width: '190px' },
    { icon: Download, label: 'Actions', width: '240px' },
  ];

  return (
    <>
      <PageHeader
        title="Coffre"
        actions={
          <>
            <PillSelect value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupBy)}>
              {(Object.keys(GROUP_LABELS) as GroupBy[]).map((value) => (
                <option key={value} value={value}>
                  {value === 'folder' ? 'Vue dossiers' : `Regrouper par ${GROUP_LABELS[value].toLowerCase()}`}
                </option>
              ))}
            </PillSelect>
            <Button
              icon={<FolderPlus size={18} strokeWidth={1.75} />}
              onClick={() => {
                // Le champ s'ouvre toujours, même si un filtre masquait la vue dossiers.
                setGroupBy('folder');
                clearFilters();
                setCreatingFolder(true);
              }}
            >
              Nouveau dossier
            </Button>
            <Button
              variant="primary"
              icon={<Upload size={18} strokeWidth={1.75} />}
              onClick={() => fileInput.current?.click()}
            >
              Déposer un document
            </Button>
          </>
        }
      />

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
        onChange={(event: ChangeEvent<HTMLInputElement>) => pick(event.target.files?.[0])}
      />

      {pendingFile && (
        <DocumentForm
          file={pendingFile}
          folders={folders}
          currentFolderId={folderId}
          onCancel={() => setPendingFile(null)}
          onDone={async (message) => {
            setPendingFile(null);
            await refresh();
            toast.success(message);
          }}
        />
      )}

      {editing && (
        <DocumentForm
          document={editing}
          folders={folders}
          currentFolderId={folderId}
          onCancel={() => setEditing(null)}
          onDone={async (message) => {
            setEditing(null);
            await refresh();
            toast.success(message);
          }}
        />
      )}

      <Card className="mb-6">
        <CardHeader icon={Search} title="Recherche et filtres" />
        <div className="grid grid-cols-1 gap-4 border-t border-card-line px-8 py-6 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-2">
            <Label>Titre, parties ou tag</Label>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher" />
          </label>
          <label className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Tous les types</option>
              {DOCUMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {DOCUMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-2">
            <Label>Jalon</Label>
            <Select value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)}>
              <option value="">Tous les jalons</option>
              {milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-2">
            <Label>Tag</Label>
            <Select value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="">Tous les tags</option>
              {tags.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-2">
            <Label>Depuis</Label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="flex flex-col gap-2">
            <Label>Jusqu'au</Label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </Card>

      <Card
        onDragOver={(event: DragEvent<HTMLElement>) => event.preventDefault()}
        onDrop={(event: DragEvent<HTMLElement>) => {
          event.preventDefault();
          pick(event.dataTransfer.files?.[0]);
        }}
      >
        <CardHeader
          icon={Archive}
          title="Documents"
          meta={<span className="text-sub text-muted">{rows.length} document(s)</span>}
          actions={
            <span className="text-sub text-muted">
              {browsingFolders
                ? 'Glisser un document sur un dossier pour le ranger'
                : 'Recherche dans tout le coffre, dossiers confondus'}
            </span>
          }
        />

        {error && (
          <div className="px-8 pb-4">
            <FieldError message={error} />
          </div>
        )}

        {!browsingFolders && (
          <div className="flex flex-wrap items-center gap-3 border-t border-card-line px-8 py-4 text-sub text-muted">
            <FolderPlus size={16} strokeWidth={1.75} />
            {filtering
              ? 'Les dossiers sont masqués tant qu’un filtre ou une recherche est actif.'
              : 'Les dossiers sont masqués par le regroupement choisi.'}
            <button
              type="button"
              onClick={() => {
                setGroupBy('folder');
                clearFilters();
              }}
              className="rounded-lg px-2 py-1 text-ink-soft underline-offset-2 hover:bg-hover hover:underline"
            >
              Revenir à la vue dossiers
            </button>
          </div>
        )}

        {browsingFolders && (
          <FolderGrid
            folders={folders}
            currentId={folderId}
            onOpen={openFolder}
            creating={creatingFolder}
            onCreatingChange={setCreatingFolder}
            onCreate={(name, parentId) => void createFolder(name, parentId)}
            onRename={(folder, name) => void renameFolder(folder, name)}
            onDelete={(folder) => void deleteFolder(folder)}
            onDropItem={(targetId, payload) => void dropOnFolder(targetId, payload)}
          />
        )}

        {browsingFolders ? (
          <Table columns={columns}>
            {rows.map((document) => documentRow(document, false))}
            {rows.length === 0 && (
              <tr>
                <Cell first className="text-muted">
                  Ce dossier ne contient aucun document. Glissez un fichier ici pour le déposer.
                </Cell>
                <Cell />
                <Cell />
                <Cell />
              </tr>
            )}
          </Table>
        ) : (
          <div className="border-t border-card-line">
            {group(rows, groupBy === 'folder' ? 'type' : groupBy).map(([name, documents]) => (
              <section key={name}>
                <h3 className="flex items-center gap-3 bg-head px-8 py-3 text-body font-medium text-ink">
                  {groupBy === 'tag' ? <Pill label={name} tone="gray" /> : name}
                  <span className="text-sub text-muted">{documents.length}</span>
                </h3>
                <Table columns={columns}>{documents.map((document) => documentRow(document, true))}</Table>
              </section>
            ))}
            {rows.length === 0 && (
              <p className="px-8 py-6 text-body text-muted">Aucun document ne correspond.</p>
            )}
          </div>
        )}
      </Card>

      {folders.length === 0 && browsingFolders && (
        <p className="mt-4 flex items-center gap-2 text-sub text-muted">
          <FolderPlus size={16} strokeWidth={1.75} />
          Le coffre n'a pas encore de dossier : « Nouveau dossier », en haut à droite ou dans la liste.
        </p>
      )}
    </>
  );
}
