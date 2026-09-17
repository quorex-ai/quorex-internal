import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Milestone, TeamMember } from '@quorex/shared';
import { useResource } from './useApi';

interface MilestonesResponse {
  milestones: Milestone[];
}

interface UsersResponse {
  users: TeamMember[];
}

interface TeamData {
  milestones: Milestone[];
  users: TeamMember[];
  loading: boolean;
  error: string | null;
  /** A appeler apres toute mutation qui touche les jalons. */
  reloadMilestones: () => Promise<void>;
}

const TeamContext = createContext<TeamData | null>(null);

/**
 * Jalons et comptes sont lus une fois pour toute l'application : la barre
 * laterale, le tableau de bord et les filtres partagent la meme source.
 */
export function TeamProvider({ children }: { children: ReactNode }): JSX.Element {
  const milestones = useResource<MilestonesResponse>('/milestones');
  const users = useResource<UsersResponse>('/users');

  const value = useMemo<TeamData>(
    () => ({
      milestones: milestones.data?.milestones ?? [],
      users: users.data?.users ?? [],
      loading: milestones.loading || users.loading,
      error: milestones.error ?? users.error,
      reloadMilestones: milestones.reload,
    }),
    [milestones.data, milestones.loading, milestones.error, milestones.reload, users.data, users.loading, users.error],
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam(): TeamData {
  const context = useContext(TeamContext);
  if (!context) throw new Error("useTeam doit etre utilise a l'interieur de TeamProvider.");
  return context;
}
