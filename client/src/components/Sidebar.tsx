import { NavLink, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { FOOTER_ITEMS, SECTIONS, type NavItem } from '../lib/nav';
import { useTeam } from '../lib/store';
import { milestoneColor } from '../lib/colors';

/** Le badge vert de la reference porte ici la version de l'outil. */
const APP_VERSION = '0.1';

function itemClasses(isActive: boolean): string {
  return [
    'flex h-[52px] items-center gap-3 rounded-item px-4 text-body transition-colors',
    isActive ? 'bg-brand text-white' : 'text-ink-soft hover:bg-hover',
  ].join(' ');
}

function SidebarLink({ item }: { item: NavItem }): JSX.Element {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => itemClasses(isActive)}>
      {({ isActive }) => (
        <>
          <Icon size={20} strokeWidth={isActive ? 2 : 1.75} className="shrink-0" />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar(): JSX.Element {
  const { milestones } = useTeam();
  const navigate = useNavigate();

  // « Jalons en cours » : tout ce qui n'est pas ferme, dans l'ordre choisi.
  const open = milestones.filter((milestone) => milestone.status !== 'closed');

  return (
    <aside className="flex w-[310px] shrink-0 flex-col border-r border-line bg-shell">
      <div className="px-7 pt-7 pb-6">
        <p className="font-serif text-[32px] leading-none text-ink">quorex</p>
        <p className="mt-1 text-cap text-muted">internal</p>
      </div>

      <nav className="flex flex-col gap-1 px-4">
        {SECTIONS.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
      </nav>

      <div className="mx-7 my-6 border-t border-line" />

      <div className="px-7">
        <div className="flex items-center justify-between">
          <h2 className="text-body font-medium text-ink">Jalons</h2>
          <button
            type="button"
            onClick={() => navigate('/jalons')}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-hover hover:text-ink"
            title="Créer un jalon"
            aria-label="Créer un jalon"
          >
            <Plus size={20} strokeWidth={1.75} />
          </button>
        </div>

        {open.length === 0 ? (
          <p className="mt-4 text-sub text-muted">Aucun jalon en cours.</p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {open.map((milestone) => (
              <li key={milestone.id}>
                <NavLink
                  to="/jalons"
                  className="flex items-center gap-3 rounded-item px-2 py-2.5 text-sub text-ink-soft transition-colors hover:bg-hover"
                  title={milestone.title}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-lg"
                    style={{ backgroundColor: milestoneColor(milestone.id) }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{milestone.title}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-1 px-4 pb-6">
        {FOOTER_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => itemClasses(isActive)}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2 : 1.75} className="shrink-0" />
                  <span>{item.label}</span>
                  {item.to === '/aide' && (
                    <span className="ml-auto rounded-md bg-pill-green px-2 py-0.5 text-cap font-medium text-pill-green-ink">
                      {APP_VERSION}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
