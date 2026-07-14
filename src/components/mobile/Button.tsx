import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassPanel } from './GlassPanel';
import { colors, layout, radii, typography } from './theme';

export type ButtonVariant = 'primary' | 'dark' | 'ghost' | 'soft' | 'green' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  /** Rendered before the label — pass an <Icon/> or <WhatsAppLogo/>. */
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Label colour per variant — icons should be tinted to match. */
export const buttonTextColor: Record<ButtonVariant, string> = {
  primary: '#FFFFFF',
  dark: '#FFFFFF',
  ghost: colors.navy,
  soft: colors.blueDark,
  green: '#FFFFFF',
  danger: colors.red,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  style,
}: ButtonProps): React.JSX.Element {
  const height = size === 'sm' ? layout.buttonHeightSm : layout.buttonHeight;
  const radius = size === 'sm' ? radii.sm + 1 : radii.button;
  const text = size === 'sm' ? typography.buttonSm : typography.button;

  const handlePress = (): void => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const inner = (
    <View style={[styles.inner, { height }]}>
      {icon}
      <Text style={[text, { color: buttonTextColor[variant] }]}>{label}</Text>
    </View>
  );

  // The ghost button IS a glass surface; the solid variants are not — glass on a
  // saturated fill just muddies it.
  const body =
    variant === 'ghost' ? (
      <GlassPanel effect="clear" radius={radius} style={{ height }}>
        {inner}
      </GlassPanel>
    ) : (
      <View style={[styles.solid, solidStyles[variant], { height, borderRadius: radius }]}>{inner}</View>
    );

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  solid: { overflow: 'hidden' },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});

const solidStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.blue,
    shadowColor: colors.blue,
    shadowOpacity: 0.32,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  dark: { backgroundColor: colors.navy },
  soft: { backgroundColor: colors.ice },
  green: {
    backgroundColor: colors.green,
    shadowColor: colors.green,
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  danger: { backgroundColor: colors.redBg },
  ghost: {},
});
