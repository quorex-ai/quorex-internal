import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoaderCircle, LogIn } from 'lucide-react';
import { ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

interface LocationState {
  from?: string;
}

export function Login(): JSX.Element {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status === 'authenticated') {
    const state = location.state as LocationState | null;
    return <Navigate to={state?.from ?? '/'} replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await signIn(login, password);
      const state = location.state as LocationState | null;
      navigate(state?.from ?? '/', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught.message
          : 'Connexion impossible. Le serveur ne répond pas.',
      );
      setPassword('');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="app-scale flex items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-[420px] rounded-card border border-card-line bg-card px-10 py-12">
        <p className="font-serif text-[32px] leading-none text-ink">quorex</p>
        <p className="mt-1 text-cap text-muted">internal</p>

        <h1 className="mt-8 text-card font-semibold text-ink">Connexion</h1>
        <p className="mt-2 text-sub text-muted">Outil interne. Accès réservé aux deux comptes de l'équipe.</p>

        <form className="mt-8 flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)}>
          <label className="flex flex-col gap-2">
            <span className="text-sub font-medium text-ink-soft">Login</span>
            <input
              type="text"
              name="login"
              autoComplete="username"
              autoFocus
              required
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              className="h-12 rounded-[10px] border border-card-line bg-card px-4 text-body text-ink focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sub font-medium text-ink-soft">Mot de passe</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-[10px] border border-card-line bg-card px-4 text-body text-ink focus:border-brand focus:outline-none"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-[10px] bg-pill-pink px-4 py-3 text-sub text-pill-pink-ink"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-brand text-body font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <LogIn size={18} strokeWidth={2} />
            )}
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
