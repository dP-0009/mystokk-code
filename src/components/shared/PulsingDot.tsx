import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

interface PulsingDotProps {
  /** Diameter of the solid core dot, in px. */
  size?: number;
  color?: string;
}

/**
 * A red attention dot that slowly grows and shrinks (and an expanding fading
 * halo behind it), looping forever. Used on the sidebar Reservation Hub item
 * when a reservation is awaiting the vendor's response.
 *
 * Scale/opacity animations can't use the native driver on web (RN-web animates
 * them off the JS thread either way), so we gate `useNativeDriver` by platform.
 */
export function PulsingDot({ size = 8, color = '#EF4444' }: PulsingDotProps): React.JSX.Element {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Expanding fading halo */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }}
      />
      {/* Solid pulsing core */}
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale: coreScale }],
        }}
      />
    </View>
  );
}
