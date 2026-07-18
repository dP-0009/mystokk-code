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
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BRAND } from '../../constants/brand';
import { LOCKUP } from './BrandLogo';
import { TIMELINE } from './brandLoaderTimeline';

/**
 * BrandLoader — the ONLY loading indicator in the app, on every surface and both
 * platforms. A 1:1 implementation of design/loader-reference.html: four blocks
 * fly in and assemble, the top-right block ignites navy → primary in place, then
 * releases up-right by (+9, −10) into the final lockup.
 *
 * Logo only — there is never a wordmark or any text in a loading state.
 *
 * Modes:
 *  - `once`  — the 480ms action, then holds the finished lockup. Cold start.
 *  - `loop`  — the same action, a hold, then a fade-out, repeating on the
 *              reference's 1.4s cycle. Every other loading state.
 *
 * Sizes: 150 full-screen · 90 modal/sheet/section · 56 small inline.
 */
// Geometry is shared with BrandLogo, motion with BrandLoader.web.tsx (TIMELINE),
// so the static mark, the native loader and the web loader can never drift.
const { STAGE, BLOCK, RADIUS, SLOTS, TR_RELEASE } = LOCKUP;
const { DURATION, LOOP_DURATION, LOOP_FADE_START, FROM } = TIMELINE;
const EASE = Easing.bezier(...TIMELINE.EASE_BEZIER);

export type BrandLoaderMode = 'once' | 'loop';

export function BrandLoader({
  size = STAGE,
  mode = 'loop',
  onComplete,
}: {
  /** Rendered stage size in px. Geometry scales by `size / 150`. */
  size?: number;
  /** `once` holds the end state (cold start); `loop` repeats (all other loads). */
  mode?: BrandLoaderMode;
  /** Fired when a `once` run finishes. */
  onComplete?: () => void;
}): React.JSX.Element {
  const k = size / STAGE;
  const loop = mode === 'loop';
  const p = useSharedValue(0);

  // Phase breakpoints, as fractions of whichever cycle this mode runs. In `loop`
  // the action occupies the leading 480ms of the 1400ms cycle; the rest is hold
  // then fade-out. In `once` the action fills the timeline and holds.
  const D = loop ? LOOP_DURATION : DURATION;
  const FADE_IN_END = TIMELINE.FADE_END / D;
  const ASSEMBLE_END = TIMELINE.ASSEMBLE_END / D;
  const IGNITE_START = TIMELINE.IGNITE_START / D;
  const IGNITE_END = TIMELINE.IGNITE_END / D;
  const RELEASE_START = TIMELINE.RELEASE_START / D;
  const ACTION_END = DURATION / D; // 1 in `once`, ~0.343 in `loop`
  const FADE_OUT_START = LOOP_FADE_START / D;

  // Opacity ramps in; a looping run also fades out before the cycle wraps.
  const fadeRange = loop ? [0, FADE_IN_END, FADE_OUT_START, 1] : [0, FADE_IN_END];
  const fadeOutput = loop ? [0, 1, 1, 0] : [0, 1];

  React.useEffect(() => {
    p.value = 0;
    if (loop) {
      p.value = withRepeat(
        withSequence(
          // withRepeat resumes a sequence from its CURRENT value (1, after the
          // fade-out), so snap back to 0 first or the next cycle runs backwards.
          // Invisible: opacity is 0 at both p=1 and p=0.
          withTiming(0, { duration: 0 }),
          withTiming(ACTION_END, { duration: DURATION, easing: EASE }),
          withTiming(FADE_OUT_START, { duration: LOOP_FADE_START - DURATION }),
          withTiming(1, { duration: LOOP_DURATION - LOOP_FADE_START }),
        ),
        -1,
        false,
      );
      return;
    }
    p.value = withTiming(1, { duration: DURATION, easing: EASE }, (finished) => {
      if (finished && onComplete) runOnJS(onComplete)();
    });
    // Mode is fixed for the lifetime of a mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);

  // Blocks that only assemble (TL, BL, BR): fade in, then fly to their slot.
  const tlStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, fadeRange, fadeOutput, Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(p.value, [0, ASSEMBLE_END], [FROM.tl.x * k, 0], Extrapolation.CLAMP) },
      { translateY: interpolate(p.value, [0, ASSEMBLE_END], [FROM.tl.y * k, 0], Extrapolation.CLAMP) },
    ],
  }));
  const blStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, fadeRange, fadeOutput, Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(p.value, [0, ASSEMBLE_END], [FROM.bl.x * k, 0], Extrapolation.CLAMP) },
      { translateY: interpolate(p.value, [0, ASSEMBLE_END], [FROM.bl.y * k, 0], Extrapolation.CLAMP) },
    ],
  }));
  const brStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, fadeRange, fadeOutput, Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(p.value, [0, ASSEMBLE_END], [FROM.br.x * k, 0], Extrapolation.CLAMP) },
      { translateY: interpolate(p.value, [0, ASSEMBLE_END], [FROM.br.y * k, 0], Extrapolation.CLAMP) },
    ],
  }));

  // Top-right: assemble → ignite → release, holding through the rest of the cycle.
  const trStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, fadeRange, fadeOutput, Extrapolation.CLAMP),
    backgroundColor: interpolateColor(
      p.value,
      [IGNITE_START, IGNITE_END],
      [BRAND.navy, BRAND.primary],
    ),
    transform: [
      {
        translateX: interpolate(
          p.value,
          [0, ASSEMBLE_END, RELEASE_START, ACTION_END],
          [FROM.tr.x * k, 0, 0, TR_RELEASE.x * k],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          p.value,
          [0, ASSEMBLE_END, RELEASE_START, ACTION_END],
          [FROM.tr.y * k, 0, 0, TR_RELEASE.y * k],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const block = (slot: keyof typeof SLOTS): object => ({
    width: BLOCK * k,
    height: BLOCK * k,
    borderRadius: RADIUS * k,
    left: SLOTS[slot].left * k,
    top: SLOTS[slot].top * k,
  });

  return (
    <View style={styles.center} accessibilityRole="progressbar">
      <View style={{ width: size, height: size }}>
        <Animated.View style={[styles.block, styles.navy, block('tl'), tlStyle]} />
        <Animated.View style={[styles.block, styles.navy, block('bl'), blStyle]} />
        <Animated.View style={[styles.block, styles.navy, block('br'), brStyle]} />
        <Animated.View style={[styles.block, block('tr'), trStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  block: { position: 'absolute' },
  navy: { backgroundColor: BRAND.navy },
});
