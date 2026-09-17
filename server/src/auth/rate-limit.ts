/**
 * Limiteur en memoire pour /api/auth/login : 5 tentatives par 15 minutes par IP.
 * L'application tourne en un seul processus sur un VPS, une map suffit.
 */
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly maxAttempts: number = LOGIN_MAX_ATTEMPTS,
    private readonly windowMs: number = LOGIN_WINDOW_MS,
  ) {}

  /** Compte une tentative et dit si elle est autorisee. */
  consume(key: string, now: number = Date.now()): RateLimitVerdict {
    this.sweep(now);

    const current = this.windows.get(key);
    const window = current && current.resetAt > now ? current : { count: 0, resetAt: now + this.windowMs };

    window.count += 1;
    this.windows.set(key, window);

    const retryAfterSeconds = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
    if (window.count > this.maxAttempts) {
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    return {
      allowed: true,
      remaining: this.maxAttempts - window.count,
      retryAfterSeconds,
    };
  }

  /** Une connexion reussie rend ses tentatives a l'IP. */
  reset(key: string): void {
    this.windows.delete(key);
  }

  private sweep(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
