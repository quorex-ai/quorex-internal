import {
  Archive,
  CalendarDays,
  ChartNoAxesGantt,
  CircleHelp,
  Flag,
  LayoutGrid,
  Link2,
  ScrollText,
  Settings,
  SquareKanban,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Les huit sections de quorex-internal, dans l'ordre du brief. */
export const SECTIONS: NavItem[] = [
  { to: '/', label: 'Tableau de bord', icon: LayoutGrid },
  { to: '/jalons', label: 'Jalons', icon: Flag },
  { to: '/taches', label: 'Tâches', icon: SquareKanban },
  { to: '/journal', label: 'Journal', icon: ScrollText },
  { to: '/hebdo', label: 'Hebdo', icon: CalendarDays },
  { to: '/frise', label: 'Frise', icon: ChartNoAxesGantt },
  { to: '/liens', label: 'Liens', icon: Link2 },
  { to: '/coffre', label: 'Coffre', icon: Archive },
];

export const FOOTER_ITEMS: NavItem[] = [
  { to: '/parametres', label: 'Paramètres', icon: Settings },
  { to: '/aide', label: 'Aide', icon: CircleHelp },
];
