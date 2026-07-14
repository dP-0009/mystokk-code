import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * Gesture root — NATIVE VARIANT. Metro resolves this over GestureRoot.tsx for
 * iOS/Android; the web bundle never sees it.
 *
 * @gorhom/bottom-sheet's pan gestures (drag-to-dismiss, the grab handle) are
 * inert without this at the root — sheets render but won't respond to touch.
 * It must wrap the whole tree, hence App.tsx.
 */
export function GestureRoot({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <GestureHandlerRootView style={styles.root}>{children}</GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
