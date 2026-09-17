import { z } from 'zod';

export const loginInputSchema = z.object({
  login: z.string().trim().min(1, 'Le login est obligatoire').max(64),
  password: z.string().min(1, 'Le mot de passe est obligatoire').max(256),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  login: z.string(),
  displayName: z.string(),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

/** Duree de vie d'une session : 30 jours glissants. */
export const SESSION_TTL_DAYS = 30;
