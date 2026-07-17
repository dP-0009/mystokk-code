import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BRAND } from '../../constants/brand';
import { BrandWordmark } from './BrandWordmark';

/**
 * Branded cold-start loader — the four logo blocks assemble, the top-right block
 * ignites to the brand primary, then releases to its final displaced position.
 * Plays ONCE (never loops); the end state holds. Total 480ms.
 */
const STAGE = 150;
const BLOCK = 40;
const RADIUS = 12;
const DURATION = 480;
const EASE = Easing.bezier(0.25, 1, 0.4, 1);

// Grid slots — top-left of each block within the 150×150 stage.
const SLOTS = {
  tl: { left: 30, top: 44 },
  bl: { left: 30, top: 94 },
  br: { left: 80, top: 94 },
  tr: { left: 80, top: 44 },
} as const;

// Off-screen fly-in start offsets (translate) per block.
const FROM = {
  tl: { x: -260, y: 0 },
  bl: { x: -200, y: 220 },
  br: { x: 200, y: 220 },
  tr: { x: 240, y: -200 },
} as const;

// Phase breakpoints as fractions of the 480ms timeline.
const FADE_END = 60 / DURATION; // 0.125 — opacity 0→1
const ASSEMBLE_END = 220 / DURATION; // 0.458 — blocks land
const IGNITE_START = 250 / DURATION; // 0.521 — TR color starts
const IGNITE_END = 320 / DURATION; // 0.667 — TR color done
const RELEASE_START = 320 / DURATION; // 0.667 — TR displaces
const TR_RELEASE = { x: 9, y: -10 } as const;

export function BrandLoader({ onComplete }: { onComplete?: () => void }): React.JSX.Element {
  const p = useSharedValue(0);

  React.useEffect(() => {
    p.value = withTiming(1, { duration: DURATION, easing: EASE }, (finished) => {
      if (finished && onComplete) runOnJS(onComplete)();
    });
    // Run exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Blocks that only assemble (TL, BL, BR): fade in, then fly to their slot.
  const tlStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, FADE_END], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(p.value, [0, ASSEMBLE_END], [FROM.tl.x, 0], Extrapolation.CLAMP) },
      { translateY: interpolate(p.value, [0, ASSEMBLE_END], [FROM.tl.y, 0], Extrapolation.CLAMP) },
    ],
  }));
  const blStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, FADE_END], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(p.value, [0, ASSEMBLE_END], [FROM.bl.x, 0], Extrapolation.CLAMP) },
      { translateY: interpolate(p.value, [0, ASSEMBLE_END], [FROM.bl.y, 0], Extrapolation.CLAMP) },
    ],
  }));
  const brStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, FADE_END], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(p.value, [0, ASSEMBLE_END], [FROM.br.x, 0], Extrapolation.CLAMP) },
      { translateY: interpolate(p.value, [0, ASSEMBLE_END], [FROM.br.y, 0], Extrapolation.CLAMP) },
    ],
  }));

  // Top-right: assemble → hold → release, plus the navy→primary ignite.
  const trStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, FADE_END], [0, 1], Extrapolation.CLAMP),
    backgroundColor: interpolateColor(p.value, [IGNITE_START, IGNITE_END], [BRAND.navy, BRAND.primary]),
    transform: [
      {
        translateX: interpolate(
          p.value,
          [0, ASSEMBLE_END, RELEASE_START, 1],
          [FROM.tr.x, 0, 0, TR_RELEASE.x],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          p.value,
          [0, ASSEMBLE_END, RELEASE_START, 1],
          [FROM.tr.y, 0, 0, TR_RELEASE.y],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={styles.center}>
      <View style={styles.stage}>
        <Animated.View style={[styles.block, styles.navy, SLOTS.tl, tlStyle]} />
        <Animated.View style={[styles.block, styles.navy, SLOTS.bl, blStyle]} />
        <Animated.View style={[styles.block, styles.navy, SLOTS.br, brStyle]} />
        <Animated.View style={[styles.block, SLOTS.tr, trStyle]} />
      </View>
      <BrandWordmark size={22} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  stage: { width: STAGE, height: STAGE, marginBottom: 28 },
  block: { position: 'absolute', width: BLOCK, height: BLOCK, borderRadius: RADIUS },
  navy: { backgroundColor: BRAND.navy },
});
