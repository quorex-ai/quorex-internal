import { motion } from 'framer-motion';
import { CornerDownLeft, FileText, Flag, Search, SquareKanban } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { DocumentSummary, Task } from '@quorex/shared';
import { apiFetch } from '../lib/api';
import { useTeam } from '../lib/store';
import { FOOTER_ITEMS, SECTIONS } from '../lib/nav';
import { milestoneColor } from '../lib/colors';

interface Entry {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Pastille de couleur du jalon concerné, quand il y en a un. */
  color?: string;
  to: string;
  group: string;
}

interface PaletteApi {
  open: () => void;
}

const PaletteContext = createContext<PaletteApi | null>(null);

/** Retire les accents pour que « jalon » trouve « Jalons » comme « jalón ». */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function CommandPaletteProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const api = useMemo<PaletteApi>(() => ({ open: () => setIsOpen(true) }), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((value) => !value);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <PaletteContext.Provider value={api}>
      {children}
      {/* Fermeture immediate : une modale ne doit jamais survivre a sa sortie. */}
      {isOpen && <Palette onClose={() => setIsOpen(false)} />}
    </PaletteContext.Provider>
  );
}

export function usePalette(): PaletteApi {
  const context = useContext(PaletteContext);
  if (!context) throw new Error("usePalette doit etre utilise a l'interieur de CommandPaletteProvider.");
  return context;
}

function Palette({ onClose }: { onClose: () => void }): JSX.Element {
  const navigate = useNavigate();
  const { milestones } = useTeam();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const list = useRef<HTMLUListElement>(null);

  // Tâches et documents sont chargés à l'ouverture : la palette part toujours à jour.
  useEffect(() => {
    let alive = true;

    void apiFetch<{ tasks: Task[] }>('/tasks')
      .then((data) => alive && setTasks(data.tasks))
      .catch(() => undefined);
    void apiFetch<{ documents: DocumentSummary[] }>('/documents')
      .then((data) => alive && setDocuments(data.documents))
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  const entries = useMemo<Entry[]>(() => {
    const sections: Entry[] = [...SECTIONS, ...FOOTER_ITEMS].map((item) => ({
      id: `section:${item.to}`,
      label: item.label,
      hint: 'Section',
      icon: item.icon,
      to: item.to,
      group: 'Sections',
    }));

    const milestoneEntries: Entry[] = milestones.map((milestone) => ({
      id: `milestone:${milestone.id}`,
      label: milestone.title,
      hint: `${milestone.criteriaChecked}/${milestone.criteriaTotal} critères · ${milestone.tasksOpen} tâche(s) ouverte(s)`,
      icon: Flag,
      color: milestoneColor(milestone.id),
      to: `/jalons?id=${milestone.id}`,
      group: 'Jalons',
    }));

    const taskEntries: Entry[] = tasks.map((task) => ({
      id: `task:${task.id}`,
      label: task.title,
      hint: task.milestoneTitle,
      icon: SquareKanban,
      color: milestoneColor(task.milestoneId),
      to: `/taches?milestone=${task.milestoneId}&task=${task.id}`,
      group: 'Tâches',
    }));

    const documentEntries: Entry[] = documents.map((document) => ({
      id: `document:${document.id}`,
      label: document.title,
      hint: [document.folderPath || 'Racine du coffre', document.parties].filter(Boolean).join(' · '),
      icon: FileText,
      to: `/coffre?document=${document.id}`,
      group: 'Documents',
    }));

    return [...sections, ...milestoneEntries, ...taskEntries, ...documentEntries];
  }, [milestones, tasks, documents]);

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    const matching = needle === '' ? entries : entries.filter((entry) => normalize(entry.label).includes(needle));
    return matching.slice(0, 40);
  }, [entries, query]);

  useEffect(() => setCursor(0), [query]);

  const go = useCallback(
    (entry: Entry | undefined) => {
      if (!entry) return;
      navigate(entry.to);
      onClose();
    },
    [navigate, onClose],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => Math.min(results.length - 1, value + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => Math.max(0, value - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      go(results[cursor]);
    }
  };

  useEffect(() => {
    const active = list.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [cursor, results]);

  let lastGroup = '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 pt-[12vh]"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Recherche"
        className="w-full max-w-[640px] overflow-hidden rounded-card border border-card-line bg-card"
      >
        <div className="flex items-center gap-3 border-b border-card-line px-5 py-4">
          <Search size={20} strokeWidth={1.75} className="shrink-0 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une section, un jalon, une tâche, un document"
            className="w-full bg-transparent text-body text-ink placeholder:text-muted focus:outline-none"
          />
          <span className="shrink-0 rounded-lg bg-field px-2 py-1 text-cap font-medium text-muted">Échap</span>
        </div>

        <ul ref={list} className="max-h-[50vh] overflow-y-auto py-2">
          {results.map((entry, index) => {
            const Icon = entry.icon;
            const header = entry.group === lastGroup ? null : entry.group;
            lastGroup = entry.group;

            return (
              <li key={entry.id}>
                {header && (
                  <p className="px-5 pb-1 pt-3 text-cap font-medium uppercase tracking-wide text-muted">
                    {header}
                  </p>
                )}
                <button
                  type="button"
                  data-active={index === cursor}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(entry)}
                  className={[
                    'flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors',
                    index === cursor ? 'bg-hover' : '',
                  ].join(' ')}
                >
                  {entry.color ? (
                    <span
                      className="h-5 w-5 shrink-0 rounded"
                      style={{ backgroundColor: entry.color }}
                      aria-hidden="true"
                    />
                  ) : (
                    <Icon size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-ink">{entry.label}</span>
                    {entry.hint && <span className="block truncate text-sub text-muted">{entry.hint}</span>}
                  </span>
                  {index === cursor && (
                    <CornerDownLeft size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
                  )}
                </button>
              </li>
            );
          })}

          {results.length === 0 && (
            <li className="px-5 py-6 text-body text-muted">Rien ne correspond à « {query} ».</li>
          )}
        </ul>
      </motion.div>
    </motion.div>
  );
}
