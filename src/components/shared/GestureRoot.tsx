import React from 'react';

/**
 * Gesture root — WEB VARIANT (what the web bundle resolves).
 *
 * A pure passthrough: it renders its children and nothing else, so the web tree
 * is byte-identical to before this component existed. The native variant
 * (GestureRoot.native.tsx) wraps in GestureHandlerRootView, which
 * @gorhom/bottom-sheet requires for the mobile sheets.
 */
export function GestureRoot({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}
