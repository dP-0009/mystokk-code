import { QueryClient } from '@tanstack/react-query';

/**
 * The single app-wide React Query cache.
 *
 * Exported as a module singleton (not created inside <App/>) so the auth store
 * can reach it: when the signed-in user CHANGES, the cache MUST be wiped so one
 * account can never see another account's cached data after an in-tab login
 * switch (the cache is not user-scoped). See authStore.initialize().
 *
 * Defaults:
 *  - refetchOnWindowFocus off: returning to a tab keeps the page + scroll.
 *  - refetchOnReconnect on: recover after a network blip.
 *  - staleTime 60s: cuts redundant refetches during normal navigation.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 60_000,
      retry: 2,
    },
  },
});
