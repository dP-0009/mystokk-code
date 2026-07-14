import './src/styles/global.css'; // web-only global reset + token vars (ignored on native)

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { RootNavigator } from './src/navigation';
import { ErrorBoundary } from './src/components/shared/ErrorBoundary';
import { GestureRoot } from './src/components/shared/GestureRoot';
import { ToastHost } from './src/components/shared/ToastHost';
import { ConfirmHost } from './src/components/shared/ConfirmHost';
import { LightboxProvider } from './src/components/shared/Lightbox';
import { queryClient } from './src/services/queryClient';

export default function App(): React.JSX.Element {
  return (
    // ErrorBoundary is the outermost app node so a throw anywhere in the tree —
    // including the navigator's startup effects — renders a recoverable fallback
    // instead of a bare native crash. Providers live inside it so the fallback
    // itself has no dependency on them.
    <ErrorBoundary>
      {/* Native: GestureHandlerRootView — @gorhom/bottom-sheet's pan gestures are
          inert without it, so every mobile sheet would render but not respond.
          Web: a pure passthrough that renders {children} with no wrapper element,
          so the web tree is byte-identical (CLAUDE.md rule 1). */}
      <GestureRoot>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <LightboxProvider>
              <RootNavigator />
            </LightboxProvider>
            <ConfirmHost />
            <ToastHost />
            <StatusBar style="dark" />
          </SafeAreaProvider>
        </QueryClientProvider>
      </GestureRoot>
    </ErrorBoundary>
  );
}
