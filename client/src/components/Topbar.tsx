import { Bell, ChevronDown, LogOut, Plus, Search } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Avatar } from './ui/Avatar';
import { usePalette } from './CommandPalette';

/** Le bouton d'action de la maquette n'a pas de cible unique : chaque section a la sienne. */
const PENDING = "Chaque section a son propre bouton de création.";

export function Topbar(): JSX.Element {
  const { user, signOut } = useAuth();
  const palette = usePalette();

  return (
    <header className="flex h-[100px] shrink-0 items-center gap-6 border-b border-line px-8">
      <button
        type="button"
        onClick={palette.open}
        className="flex h-12 w-full max-w-[560px] items-center gap-3 rounded-full bg-field px-5 text-left transition-colors hover:bg-card-line/60"
      >
        <Search size={20} strokeWidth={1.75} className="shrink-0 text-muted" />
        <span className="w-full text-sub text-muted">Rechercher ou taper une commande</span>
        <span className="shrink-0 rounded-lg bg-shell px-2 py-1 text-cap font-medium text-muted">⌘ K</span>
      </button>

      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-stretch overflow-hidden rounded-[10px] bg-brand text-white">
          <button
            type="button"
            disabled
            title={PENDING}
            className="flex items-center gap-2 px-4 py-2.5 text-sub font-medium disabled:cursor-not-allowed"
          >
            <Plus size={18} strokeWidth={2} />
            Nouveau
          </button>
          <span className="my-2 w-px bg-white/30" aria-hidden="true" />
          <button
            type="button"
            disabled
            title={PENDING}
            aria-label="Ouvrir le menu de création"
            className="px-2.5 disabled:cursor-not-allowed"
          >
            <ChevronDown size={18} strokeWidth={2} />
          </button>
        </div>

        <button
          type="button"
          disabled
          title={PENDING}
          aria-label="Notifications"
          className="relative rounded-full p-2 text-ink-soft transition-colors hover:bg-hover disabled:cursor-not-allowed"
        >
          <Bell size={22} strokeWidth={1.75} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-pill-pink-ink" />
        </button>

        {user && (
          <div className="flex items-center gap-2">
            <Avatar name={user.displayName} size={40} />
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="rounded-full p-2 text-muted transition-colors hover:bg-hover hover:text-ink"
            >
              <LogOut size={18} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
