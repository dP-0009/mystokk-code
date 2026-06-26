import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/tokens';

interface GoogleButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
}

export function GoogleButton({ title, onPress, loading = false }: GoogleButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.button, pressed && !loading ? styles.pressed : null]}
    >
      {loading ? (
        <ActivityIndicator color={colors.navy} />
      ) : (
        <View style={styles.row}>
          <Text style={styles.icon}>🔵</Text>
          <Text style={styles.label}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.slate700 },
});
