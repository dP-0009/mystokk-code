import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandLoader } from './BrandLoader';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../../theme/tokens';
import { webOnly } from '../layout/web';

/**
 * Standardized loading + error states, so every screen presents these the same
 * way. (Empty states use the existing `EmptyState` component — not duplicated
 * here.) Drop-in replacements for the bespoke spinners and error blocks.
 */

/** Loading states are the animated block logo alone — never any text. */
export function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.center} accessibilityRole="progressbar">
      <BrandLoader mode="loop" size={150} />
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.center}>
      <View style={[styles.iconWrap, styles.iconWrapError]}>
        <Ionicons name="alert-circle-outline" size={30} color={colors.red} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.sub}>{message ?? 'Please try again.'}</Text>
      {onRetry ? <ActionButton label="Retry" onPress={onRetry} /> : null}
    </View>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable style={[styles.btn, webOnly({ cursor: 'pointer' })]} onPress={onPress}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 6 },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.bgChip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconWrapError: { backgroundColor: colors.redLight },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19, maxWidth: 320 },
  btn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: radius.md,
  },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
