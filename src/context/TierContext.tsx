import { createContext, useContext, type ReactNode } from 'react';
import { useUser } from './UserContext';
import { getUserTier, type UserTier } from '@/lib/getUserTier';

const TierContext = createContext<UserTier | null>(null);

export function TierProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  return <TierContext.Provider value={getUserTier(user?.grade)}>{children}</TierContext.Provider>;
}

/** Returns null while signed out, loading, or when no valid grade is set. */
export function useTier(): UserTier | null {
  return useContext(TierContext);
}
