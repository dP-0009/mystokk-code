import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';

/**
 * Temporary placeholder used by every screen until its real UI is built in a
 * later phase. Shows the screen name centered on the app background.
 */
export function PlaceholderScreen({ name }: { name: string }): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>MyStokk</Text>
      </View>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.subtitle}>Screen placeholder — built in a later phase</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  badge: {
    backgroundColor: colors.navy,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  badgeText: { color: colors.slate50, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '700', color: colors.navy, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.slate500, textAlign: 'center' },
});
