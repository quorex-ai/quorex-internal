import { motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TeamProvider } from '../lib/store';
import { ToastProvider } from '../lib/toast';
import { CommandPaletteProvider } from './CommandPalette';

/** Fond gris, application en une grande carte a 16 px du bord. */
export function AppShell(): JSX.Element {
  const location = useLocation();

  return (
    <TeamProvider>
      <ToastProvider>
        <CommandPaletteProvider>
          <div className="app-scale bg-canvas p-4">
            <div className="app-card-height flex overflow-hidden rounded-card border border-line bg-shell">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <Topbar />
                <motion.main
                  key={location.pathname}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="flex-1 px-8 py-8"
                >
                  <Outlet />
                </motion.main>
              </div>
            </div>
          </div>
        </CommandPaletteProvider>
      </ToastProvider>
    </TeamProvider>
  );
}
