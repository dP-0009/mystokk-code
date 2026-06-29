import React, { useEffect, useRef } from 'react';
import { Animated, Platform, type StyleProp, type ViewStyle } from 'react-native';

interface RevealProps {
  children: React.ReactNode;
  /** Stagger delay before the entrance starts (ms). */
  delay?: number;
  /** Entrance duration (ms). */
  duration?: number;
  /** How far (px) the content slides up into place. */
  offsetY?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Mount-time entrance: fade in while sliding up. Used to stagger hero copy,
 * feature cards and the auth card so the marketing/auth surfaces feel alive
 * without pulling in an animation library.
 *
 * The RN `Animated` API runs on react-native-web too. The native thread driver
 * isn't available on web, so we only enable it off-web (opacity/transform are
 * cheap enough on the JS driver for a one-shot entrance).
 */
export function Reveal({
  children,
  delay = 0,
  duration = 600,
  offsetY = 24,
  style,
}: RevealProps): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, duration]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offsetY, 0],
  });

  return (
    <Animated.View style={[{ opacity: progress, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
