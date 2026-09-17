import type { DragEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Depot de fichier par glisser-deposer, utilise par le coffre. */
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
}

/** Carte blanche bordee, coins 16 px, sans ombre : la brique de toutes les sections. */
export function Card({ children, className = '', onDragOver, onDrop }: CardProps): JSX.Element {
  return (
    <section
      className={`rounded-card border border-card-line bg-card ${className}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
    </section>
  );
}

interface CardHeaderProps {
  icon: LucideIcon;
  title: string;
  /** Rendu a droite du titre (selecteur en pilule, par exemple). */
  meta?: ReactNode;
  /** Rendu tout a droite de l'en-tete (« Tout voir »). */
  actions?: ReactNode;
}

export function CardHeader({ icon: Icon, title, meta, actions }: CardHeaderProps): JSX.Element {
  return (
    <header className="flex items-center gap-4 px-8 py-6">
      <Icon size={22} strokeWidth={1.5} className="shrink-0 text-ink" />
      <h2 className="text-card font-semibold text-ink">{title}</h2>
      {meta}
      <div className="ml-auto">{actions}</div>
    </header>
  );
}
