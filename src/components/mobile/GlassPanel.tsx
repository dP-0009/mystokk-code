import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { glass, radii } from './theme';

/**
 * Glass effect intent:
 *   'regular' — nav chrome, tab bar, sheets, popovers (frosted, opaque-ish)
 *   'clear'   — floating buttons sitting directly over content (FAB, nav buttons)
 */
export type GlassEffect = 'regular' | 'clear';

export interface GlassPanelProps {
  children?: React.ReactNode;
  effect?: GlassEffect;
  /** Corner radius. Pick from `radii` so surfaces stay consistent. */
  radius?: number;
  /**
   * Fill applied on the fallback path. Use the `glass.fill*` ladder — sheets and
   * popovers must be brighter than cards.
   */
  fill?: string;
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * THE glass surface. Every panel, bar, card, input and floating button in the
 * mobile UI is built on this — nothing re-implements the blur.
 *
 * On iOS 26 this is a real liquid-glass GlassView. Everywhere else (Android,
 * older iOS) it degrades to a translucent fill + hairline border + soft shadow,
 * which is why `fill` matters: the fallback has no blur to create depth, so the
 * brightness ladder is doing that work on its own.
 *
 * Do NOT use this for full-screen backgrounds — glass is for panels and bars
 * only. Screens get <ScreenBackground/>.
 */
export function GlassPanel({
  children,
  effect = 'regular',
  radius = radii.card,
  fill,
  tintColor,
  style,
}: GlassPanelProps): React.JSX.Element {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle={effect}
        tintColor={tintColor}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        glass.fallback,
        { borderRadius: radius, backgroundColor: fill ?? glass.fallback.backgroundColor },
        style,
      ]}
    >
      {children}
    </View>
  );
}
