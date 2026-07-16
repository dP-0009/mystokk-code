import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * Gesture root — NATIVE VARIANT. Metro resolves this over GestureRoot.tsx for
 * iOS/Android; the web bundle never sees it.
 *
 * Wraps the whole tree in GestureHandlerRootView, which other gesture-driven
 * features (swipeable rows, the photo lightbox pan/pinch) require at the root.
 * The Sheet system is now pure React Native, so no bottom-sheet provider is
 * mounted here anymore.
 */
export function GestureRoot({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <GestureHandlerRootView style={styles.root}>{children}</GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
