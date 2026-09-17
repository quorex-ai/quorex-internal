import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, apiFetch } from './api';

export interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/** Lecture d'une route d'API, rechargeable apres mutation. `null` : rien a lire. */
export function useResource<T>(path: string | null): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (path === null) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch<T>(path);
      if (!alive.current) return;
      setData(result);
      setError(null);
    } catch (caught) {
      if (!alive.current) return;
      setError(caught instanceof ApiRequestError ? caught.message : 'Le serveur ne répond pas.');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load };
}

/** Message d'erreur lisible pour l'utilisateur, jamais une stack. */
export function errorMessage(caught: unknown): string {
  return caught instanceof ApiRequestError ? caught.message : "L'opération a échoué.";
}
