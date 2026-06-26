import './src/styles/global.css'; // web-only global reset + token vars (ignored on native)

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RootNavigator } from './src/navigation';
import { ToastHost } from './src/components/shared/ToastHost';
import { LightboxProvider } from './src/components/shared/Lightbox';

/**
 * Switching browser tabs and coming back must NOT refetch/flash the page.
 * React Query's default `refetchOnWindowFocus` does exactly that, so we disable
 * it and keep data fresh for 60s — returning to a tab stays on the same page and
 * scroll position. Screens still refresh on real navigation (useFocusEffect) and
 * data is invalidated after mutations, so nothing goes stale in practice.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <LightboxProvider>
          <RootNavigator />
        </LightboxProvider>
        <ToastHost />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
