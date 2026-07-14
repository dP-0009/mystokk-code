import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { GlassPanel } from './GlassPanel';
import { Icon, type IconName } from './Icon';
import { colors, spacing, typography } from './theme';

/**
 * Round glass button (.navbtn) — back, filter, overflow, photo arrows. Uses the
 * 'clear' effect because it floats directly over content.
 */
export function NavButton({
  icon,
  onPress,
  size = 42,
  color = colors.navy,
  badge = false,
}: {
  icon: IconName;
  onPress?: () => void;
  size?: number;
  color?: string;
  /** Red unread dot, top-right (.dot). */
  badge?: boolean;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <GlassPanel
        effect="clear"
        radius={size / 2}
        style={[styles.navBtn, { width: size, height: size }]}
      >
        <Icon name={icon} size={size * 0.48} color={color} />
      </GlassPanel>
      {badge ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

/**
 * Top nav (.nav): optional back button, centred title, optional right slot.
 * Sits above the scroll view — screens pad their content by `layout.navHeight`.
 */
export function NavBar({
  title,
  onBack,
  right,
}: {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
      <View style={styles.side}>{onBack ? <NavButton icon="back" onPress={onBack} /> : null}</View>
      <Text style={[typography.navTitle, styles.title]} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.gutter,
    paddingBottom: 10,
  },
  side: { width: 42, flexDirection: 'row' },
  sideRight: { justifyContent: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
  navBtn: { alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.red,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  pressed: { transform: [{ scale: 0.9 }] },
});
