'use client';

import { useAuth } from '@/context/auth-context';

export function useIsAdmin() {
  const { isAdmin, adminLoading } = useAuth();
  return { isAdmin, loading: adminLoading };
}
