import React from 'react';

import { BrandLoader } from './BrandLoader';
import { TIMELINE } from './brandLoaderTimeline';
import { useAuthStore } from '../../stores/authStore';

/**
 * Cold-start gate — WEB VARIANT. Web has no native splash screen, so this is the
 * app's first paint: a full-bleed white overlay with the branded loader, mounted
 * before auth/data resolve and torn down when BOTH (a) the 480ms animation has
 * finished AND (b) auth has settled — whichever is later. The animation is never
 * cut mid-sequence.
 *
 * The native counterpart (ColdStartGate.native.tsx) does the same thing but hands
 * off from the real splash screen. Both mount BrandLoader; only the animation
 * driver differs (Reanimated on native, CSS keyframes on web).
 */
export function ColdStartGate(): React.JSX.Element | null {
  const authReady = useAuthStore((s) => s.status !== 'loading');
  const [animDone, setAnimDone] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (animDone && authReady) setDismissed(true);
  }, [animDone, authReady]);

  // Belt-and-braces: if BrandLoader's onComplete never fires (e.g. the tab is
  // backgrounded and the CSS animation is throttled), still release on schedule.
  React.useEffect(() => {
    const t = setTimeout(() => setAnimDone(true), TIMELINE.DURATION);
    return () => clearTimeout(t);
  }, []);

  if (dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <BrandLoader mode="once" onComplete={() => setAnimDone(true)} />
    </div>
  );
}
