import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface Column {
  icon: LucideIcon;
  label: string;
  /** Largeur CSS de la colonne ; la premiere reste souple. */
  width?: string;
}

interface TableProps {
  columns: Column[];
  children: ReactNode;
}

/**
 * Tableau de la reference : en-tete gris clair, separateurs verticaux fins,
 * lignes de 64 px, bordures horizontales fines.
 */
export function Table({ columns, children }: TableProps): JSX.Element {
  return (
    <div className="overflow-x-auto border-t border-card-line">
      <table className="w-full min-w-[820px] table-fixed border-collapse text-left">
        <thead>
          <tr className="bg-head">
            {columns.map((column, index) => {
              const Icon = column.icon;
              return (
                <th
                  key={column.label}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={[
                    'px-6 py-4 text-body font-medium text-ink',
                    index > 0 ? 'border-l border-card-line' : '',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={20} strokeWidth={1.5} className="text-ink" />
                    {column.label}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

interface CellProps {
  children?: ReactNode;
  /** Premiere colonne : pas de separateur vertical a gauche. */
  first?: boolean;
  className?: string;
}

export function Cell({ children, first = false, className = '' }: CellProps): JSX.Element {
  return (
    <td
      className={[
        'h-16 border-t border-card-line px-6 text-body text-ink',
        first ? '' : 'border-l',
        className,
      ].join(' ')}
    >
      {children}
    </td>
  );
}

/** Compteur gris avec icone, aligne a droite de la premiere cellule. */
export function Counter({ icon: Icon, value }: { icon: LucideIcon; value: number | string }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 text-sub text-muted">
      <Icon size={16} strokeWidth={1.5} />
      {value}
    </span>
  );
}
