import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { webOnly } from '../layout/web';

// Official Google "G" mark — bundled as an asset rather than an emoji so the
// button matches Google's branding requirements for sign-in.
const GOOGLE_LOGO = require('../../../assets/google-logo.png');

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
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <View style={styles.row}>
          <Image source={GOOGLE_LOGO} style={styles.icon} resizeMode="contain" />
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
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgWhite,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 18, height: 18 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
});
