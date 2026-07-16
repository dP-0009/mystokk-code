import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FrostedBackground } from './FrostedBackground';

/**
 * Anchored popover (the avatar menu) — NATIVE ONLY. Frosted white glass,
 * rendered over an absolute full-screen layer so it overlaps ALL content
 * including the tab bar.
 *
 * Unlike Sheet, this is NOT a @gorhom bottom-sheet modal — it is a plain
 * absolute overlay, so conditional mounting (`open ? … : null`) is the correct
 * pattern here and has nothing to do with the sheet system.
 */
export function Popover({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  if (!open) return null;

  return (
    <View style={styles.popLayer} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, styles.popBg]} onPress={onClose} />
      <FrostedBackground style={[styles.pop, { top: insets.top + 52 }]} radius={26}>
        <View style={styles.popInner}>{children}</View>
      </FrostedBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  // Popover — full-screen layer so it overlaps everything, including the tab bar.
  popLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 },
  popBg: { backgroundColor: 'rgba(10,24,48,0.26)' },
  pop: { position: 'absolute', right: 16, width: 258 },
  popInner: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 8 },
});
