import React from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

/**
 * MystokkLoader — the "Musical Crates" brand loader, an EXACT port of
 * mystokk-loader-FINAL.html to RN Animated (works on native and web via
 * react-native-web). Three navy crates rotate around a fixed grid while the blue
 * crate escapes on its own path; 2.6s infinite cycle, cubic-bezier(.65,0,.3,1),
 * with the corner "holds" preserved.
 *
 * The source art lives in a 160×160 box (40×40 blocks, radius 12). Everything
 * scales by `size / 160`, so a caller just picks a size. `showText` renders the
 * "mystokk" wordmark underneath (navy 800, blue "o").
 */
const NAVY = '#0F172A';
const PRIMARY = '#2563EB';

// Base (160-box) geometry from the source.
const BOX = 160;
const BLOCK = 40;
const RADIUS = 12;
// Static top-left of each block within the box.
const POS = {
  b1: { left: 32, top: 48 },
  b2: { left: 32, top: 98 },
  b3: { left: 82, top: 98 },
  c: { left: 90, top: 39 },
};
// translate() targets at each of the 4 corner steps (step 0 and 4 are identical).
// Ported verbatim from the cyc1/cyc2/cyc3/cycC keyframes.
const PATHS = {
  b1: { x: [0, 50, 50, 0, 0], y: [0, 0, 50, 50, 0] },
  b2: { x: [0, 0, 50, 50, 0], y: [0, -50, -50, 0, 0] },
  b3: { x: [0, -50, -50, 0, 0], y: [0, 0, -50, -50, 0] },
  c: { x: [0, -8, -58, -58, 0], y: [0, 59, 59, 9, 0] },
};

// 2.6s cycle mapped from the keyframe percentages (holds = delays, moves = timings):
//   0–6 hold · 6–20 move · 20–29 hold · 29–43 move · 43–52 hold · 52–66 move ·
//   66–75 hold · 75–92 move · 92–100 hold.
const HOLD = { start: 156, s1: 234, s2: 234, s3: 234, end: 208 };
const MOVE = { m1: 364, m2: 364, m3: 364, m4: 442 };
const EASE = Easing.bezier(0.65, 0, 0.3, 1);

export function MystokkLoader({
  size = 160,
  showText = false,
}: {
  size?: number;
  showText?: boolean;
}): React.JSX.Element {
  const k = size / BOX;
  const step = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const useNative = Platform.OS !== 'web';
    const t = (toValue: number, duration: number): Animated.CompositeAnimation =>
      Animated.timing(step, { toValue, duration, easing: EASE, useNativeDriver: useNative });

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(HOLD.start),
        t(1, MOVE.m1),
        Animated.delay(HOLD.s1),
        t(2, MOVE.m2),
        Animated.delay(HOLD.s2),
        t(3, MOVE.m3),
        Animated.delay(HOLD.s3),
        t(4, MOVE.m4),
        Animated.delay(HOLD.end),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      step.setValue(0);
    };
  }, [step]);

  const inputRange = [0, 1, 2, 3, 4];
  const blockStyle = (key: keyof typeof PATHS): Animated.WithAnimatedObject<object> => ({
    transform: [
      { translateX: step.interpolate({ inputRange, outputRange: PATHS[key].x.map((v) => v * k) }) },
      { translateY: step.interpolate({ inputRange, outputRange: PATHS[key].y.map((v) => v * k) }) },
    ],
  });

  const block = (key: keyof typeof PATHS, color: string, extra?: object): React.JSX.Element => (
    <Animated.View
      style={[
        styles.block,
        {
          width: BLOCK * k,
          height: BLOCK * k,
          borderRadius: RADIUS * k,
          left: POS[key].left * k,
          top: POS[key].top * k,
          backgroundColor: color,
        },
        extra,
        blockStyle(key),
      ]}
    />
  );

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        {block('b1', NAVY)}
        {block('b2', NAVY)}
        {block('b3', NAVY)}
        {block('c', PRIMARY, styles.blueGlow)}
      </View>
      {showText ? (
        <Text style={[styles.brand, { fontSize: size * 0.125, marginTop: size * 0.1 }]}>
          myst<Text style={styles.brandO}>o</Text>kk
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  block: { position: 'absolute' },
  // Blue crate sits above the navy ones with a soft primary glow.
  blueGlow: {
    zIndex: 3,
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8,
  },
  brand: { color: NAVY, fontWeight: '800', letterSpacing: -0.2 },
  brandO: { color: PRIMARY },
});
