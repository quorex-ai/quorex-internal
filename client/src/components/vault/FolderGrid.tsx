import { useState, type DragEvent } from 'react';
import { ChevronRight, Folder as FolderIcon, FolderPlus, Home, Pencil, Trash2, X } from 'lucide-react';
import type { Folder } from '@quorex/shared';
import { Input } from '../ui/Field';

interface FolderGridProps {
  folders: Folder[];
  /** Dossier courant ; null pour la racine. */
  currentId: string | null;
  onOpen: (id: string | null) => void;
  onCreate: (name: string, parentId: string | null) => void;
  /** Piloté par la page pour que le bouton d'en-tête ouvre directement le champ. */
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
  onRename: (folder: Folder, name: string) => void;
  onDelete: (folder: Folder) => void;
  /** Un document ou un dossier a été lâché sur un dossier. */
  onDropItem: (targetId: string | null, payload: string) => void;
}

/** Fil d'Ariane + dossiers du niveau courant, comme un explorateur de fichiers. */
export function FolderGrid({
  folders,
  currentId,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  onDropItem,
  creating,
  onCreatingChange,
}: FolderGridProps): JSX.Element {
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);

  const children = folders.filter((folder) => folder.parentId === currentId);
  const current = currentId === null ? null : folders.find((folder) => folder.id === currentId);

  const trail: Folder[] = [];
  let walker = current;
  while (walker) {
    trail.unshift(walker);
    const parentId: string | null = walker.parentId;
    walker = parentId === null ? null : (folders.find((folder) => folder.id === parentId) ?? null);
  }

  const accept = (event: DragEvent<HTMLElement>, targetId: string | null): void => {
    event.preventDefault();
    event.stopPropagation();
    setHovered(null);
    const payload = event.dataTransfer.getData('text/plain');
    if (payload) onDropItem(targetId, payload);
  };

  return (
    <div className="border-t border-card-line px-8 py-5">
      <nav className="flex flex-wrap items-center gap-1 text-sub" aria-label="Fil d'Ariane">
        <button
          type="button"
          onClick={() => onOpen(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => accept(event, null)}
          className={[
            'flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-hover',
            currentId === null ? 'font-medium text-ink' : 'text-muted',
          ].join(' ')}
        >
          <Home size={16} strokeWidth={1.75} />
          Coffre
        </button>

        {trail.map((folder, index) => (
          <span key={folder.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-muted" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onOpen(folder.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => accept(event, folder.id)}
              className={[
                'rounded-lg px-2 py-1 transition-colors hover:bg-hover',
                index === trail.length - 1 ? 'font-medium text-ink' : 'text-muted',
              ].join(' ')}
            >
              {folder.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {children.map((folder) => (
          <div
            key={folder.id}
            draggable={renamingId !== folder.id}
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', `folder:${folder.id}`);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setHovered(folder.id);
            }}
            onDragLeave={() => setHovered((value) => (value === folder.id ? null : value))}
            onDrop={(event) => accept(event, folder.id)}
            className={[
              'group flex items-center gap-3 rounded-item border p-4 transition-colors',
              hovered === folder.id ? 'border-brand bg-brand/5' : 'border-card-line bg-card hover:bg-hover',
            ].join(' ')}
          >
            <FolderIcon size={22} strokeWidth={1.5} className="shrink-0 text-muted" />

            {renamingId === folder.id ? (
              <Input
                autoFocus
                value={renameValue}
                maxLength={120}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={() => {
                  if (renameValue.trim() && renameValue.trim() !== folder.name) {
                    onRename(folder, renameValue.trim());
                  }
                  setRenamingId(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') setRenamingId(null);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => onOpen(folder.id)}
                className="min-w-0 flex-1 text-left"
                title={folder.path}
              >
                <span className="block truncate text-body text-ink">{folder.name}</span>
                <span className="block text-sub text-muted">
                  {folder.documentCount} document(s)
                  {folder.subfolderCount > 0 ? ` · ${folder.subfolderCount} dossier(s)` : ''}
                </span>
              </button>
            )}

            <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={() => {
                  setRenamingId(folder.id);
                  setRenameValue(folder.name);
                }}
                aria-label="Renommer le dossier"
                className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-ink"
              >
                <Pencil size={16} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(folder)}
                aria-label="Supprimer le dossier"
                className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-ink"
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ))}

        {creating ? (
          <form
            className="flex items-center gap-3 rounded-item border border-brand bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (newName.trim()) onCreate(newName.trim(), currentId);
              setNewName('');
              onCreatingChange(false);
            }}
          >
            <FolderIcon size={22} strokeWidth={1.5} className="shrink-0 text-muted" />
            <Input
              autoFocus
              value={newName}
              placeholder="Nom du dossier"
              maxLength={120}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setNewName('');
                  onCreatingChange(false);
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                setNewName('');
                onCreatingChange(false);
              }}
              aria-label="Annuler"
              className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-ink"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => onCreatingChange(true)}
            className="flex items-center gap-3 rounded-item border border-dashed border-card-line p-4 text-ink-soft transition-colors hover:border-brand hover:bg-hover hover:text-ink"
          >
            <FolderPlus size={22} strokeWidth={1.5} />
            <span className="text-body">Nouveau dossier</span>
          </button>
        )}
      </div>
    </div>
  );
}
