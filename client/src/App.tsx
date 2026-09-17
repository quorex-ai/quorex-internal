import { LoaderCircle } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppShell } from './components/AppShell';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { Dashboard } from './pages/Dashboard';
import { Help } from './pages/Help';
import { Journal } from './pages/Journal';
import { Links } from './pages/Links';
import { Login } from './pages/Login';
import { Milestones } from './pages/Milestones';
import { Settings } from './pages/Settings';
import { Tasks } from './pages/Tasks';
import { Timeline } from './pages/Timeline';
import { Vault } from './pages/Vault';
import { Weekly } from './pages/Weekly';

function Loading(): JSX.Element {
  return (
    <div className="app-scale flex items-center justify-center bg-canvas">
      <LoaderCircle size={28} className="animate-spin text-muted" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Loading />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/jalons" element={<Milestones />} />
        <Route path="/taches" element={<Tasks />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/hebdo" element={<Weekly />} />
        <Route path="/frise" element={<Timeline />} />
        <Route path="/liens" element={<Links />} />
        <Route path="/coffre" element={<Vault />} />
        <Route path="/parametres" element={<Settings />} />
        <Route path="/aide" element={<Help />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App(): JSX.Element {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
