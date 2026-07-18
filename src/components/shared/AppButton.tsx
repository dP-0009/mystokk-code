import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../../theme/tokens';

type Variant = 'primary' | 'emerald' | 'dark' | 'outline' | 'translucent';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AppButton({
  title,
  onPress,
  variant = 'emerald',
  loading = false,
  disabled = false,
  style,
  testID,
}: AppButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        VARIANT_STYLE[variant],
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'outline' ? styles.labelDark : styles.labelLight]}>
        {title}
      </Text>
    </Pressable>
  );
}

const VARIANT_STYLE: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.accent },
  emerald: { backgroundColor: colors.emerald },
  dark: { backgroundColor: colors.navy },
  outline: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.slate200 },
  translucent: { backgroundColor: 'rgba(255,255,255,0.12)' },
};

const styles = StyleSheet.create({
  base: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: '700' },
  labelLight: { color: '#FFFFFF' },
  labelDark: { color: colors.navy },
});
