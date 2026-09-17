import { useCallback, useRef, useState } from 'react';
import { errorMessage } from './useApi';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface Saver {
  status: SaveStatus;
  error: string | null;
  /** Lance l'enregistrement et tient l'indicateur a jour. Rend true si ça a marché. */
  save: (run: () => Promise<unknown>) => Promise<boolean>;
  reset: () => void;
}

const SAVED_MS = 1800;

/** Enregistrement automatique : pas de bouton à chercher, un état à afficher. */
export function useSaver(): Saver {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const reset = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setStatus('idle');
    setError(null);
  }, []);

  const save = useCallback(async (run: () => Promise<unknown>): Promise<boolean> => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setStatus('saving');
    setError(null);

    try {
      await run();
      setStatus('saved');
      timer.current = window.setTimeout(() => setStatus('idle'), SAVED_MS);
      return true;
    } catch (caught) {
      setError(errorMessage(caught));
      setStatus('error');
      return false;
    }
  }, []);

  return { status, error, save, reset };
}
