import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/tokens';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
  testID?: string;
}

/**
 * Shared empty-state for list screens (documented convention: icon + helpful
 * message + CTA). Pass a CTA only when there's a sensible next action.
 */
export function EmptyState({
  icon = '📦',
  title,
  message,
  ctaLabel,
  onCta,
  testID,
}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {ctaLabel && onCta ? (
        <Pressable style={styles.cta} onPress={onCta} testID={testID ? `${testID}-cta` : 'empty-cta'}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 60 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 34 },
  title: { fontSize: 16, fontWeight: '800', color: colors.slate900, marginBottom: 6, textAlign: 'center' },
  message: { fontSize: 13, color: colors.slate500, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  cta: { backgroundColor: colors.emerald, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10 },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
