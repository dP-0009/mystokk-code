import React from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { BrandLoader } from './BrandLoader';
import { useAuthStore } from '../../stores/authStore';

// Keep the static native splash up until the BrandLoader is painted, so there's
// no blank gap between them. Native only — this file never runs on web.
void SplashScreen.preventAutoHideAsync();

/**
 * Cold-start gate (NATIVE). Overlays the branded loader on top of the app during
 * a cold start, then reveals the app when BOTH (a) the 480ms animation has
 * finished AND (b) auth/initial loading has resolved — whichever is later. The
 * animation plays once and is never cut mid-sequence.
 */
export function ColdStartGate(): React.JSX.Element | null {
  const authReady = useAuthStore((s) => s.status !== 'loading');
  const [animDone, setAnimDone] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  // Hand off from the native splash to our loader once JS has painted.
  React.useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  React.useEffect(() => {
    if (animDone && authReady) setDismissed(true);
  }, [animDone, authReady]);

  if (dismissed) return null;

  return (
    <View style={styles.overlay}>
      <BrandLoader onComplete={() => setAnimDone(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
});
