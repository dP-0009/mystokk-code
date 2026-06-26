import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
}

/** Navy app header with a centered title and an optional back arrow. */
export function ScreenHeader({ title, onBack }: ScreenHeaderProps): React.JSX.Element {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.side}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <Text style={styles.title}>{title}</Text>
        <View style={styles.side} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  side: { width: 34, alignItems: 'flex-start' },
  back: { color: '#FFFFFF', fontSize: 24, fontWeight: '600' },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
