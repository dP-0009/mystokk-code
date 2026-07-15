import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

/**
 * Full-screen photo viewer — NATIVE, custom-built on react-native-reanimated v4
 * + react-native-gesture-handler (no gallery library):
 *   • pinch-to-zoom in/out (no zoom bar), double-tap to zoom in / reset
 *   • pan while zoomed, with rubber-band resistance and spring-back at edges
 *   • smooth horizontal swipe between photos when not zoomed
 *   • swipe-down to dismiss; zoom resets when changing photos
 *
 * Callers pass ORIGINAL image URLs (full Supabase URL, no resize/transform
 * params) so the viewer shows full quality; list cards keep thumbnails.
 *
 * Same exports/contract as the web Lightbox (LightboxProvider + useLightbox), so
 * Metro swaps this in on native and the web build keeps Lightbox.tsx.
 */

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_PAGE_RATIO = 0.22;
const DISMISS_DISTANCE = 130;

function clampW(v: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(v, min), max);
}
/** Rubber-band: past a bound, movement gets 5× resistance. */
function rubber(v: number, max: number): number {
  'worklet';
  if (max <= 0) return v * 0.2;
  if (v > max) return max + (v - max) * 0.2;
  if (v < -max) return -max + (v + max) * 0.2;
  return v;
}

interface LightboxContextValue {
  open: (images: string[], index?: number) => void;
  close: () => void;
}

const LightboxContext = createContext<LightboxContextValue | null>(null);

export function LightboxProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<{ images: string[]; index: number } | null>(null);

  const open = useCallback((images: string[], index = 0): void => {
    const clean = (images ?? []).filter(Boolean);
    if (clean.length > 0) setState({ images: clean, index: Math.max(0, Math.min(index, clean.length - 1)) });
  }, []);
  const close = useCallback((): void => setState(null), []);

  return (
    <LightboxContext.Provider value={{ open, close }}>
      {children}
      {state !== null ? <GalleryViewer images={state.images} index={state.index} onClose={close} /> : null}
    </LightboxContext.Provider>
  );
}

function GalleryViewer({ images, index, onClose }: { images: string[]; index: number; onClose: () => void }): React.JSX.Element {
  const { width: W, height: H } = useWindowDimensions();
  const count = images.length;

  const [active, setActive] = useState(index);

  // Pager + per-active-page zoom state (only the active page is zoomable).
  const activeIndex = useSharedValue(index);
  const offsetX = useSharedValue(-index * W);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const dismissY = useSharedValue(0);
  const bg = useSharedValue(1);

  const resetZoom = (): void => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const settlePager = (): void => {
    'worklet';
    offsetX.value = withTiming(-activeIndex.value * W);
    dismissY.value = withTiming(0);
    bg.value = withTiming(1);
  };

  const goTo = (i: number): void => {
    'worklet';
    const clamped = Math.max(0, Math.min(count - 1, i));
    activeIndex.value = clamped;
    offsetX.value = withTiming(-clamped * W);
    resetZoom();
    runOnJS(setActive)(clamped);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clampW(savedScale.value * e.scale, 0.9, MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value <= 1) resetZoom();
      else savedScale.value = scale.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(220)
    .onEnd(() => {
      if (scale.value > 1) {
        resetZoom();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      if (scale.value > 1) {
        // Pan the zoomed image with rubber-band at the edges.
        const maxX = (W * (scale.value - 1)) / 2;
        const maxY = (H * (scale.value - 1)) / 2;
        tx.value = rubber(savedTx.value + e.translationX, maxX);
        ty.value = rubber(savedTy.value + e.translationY, maxY);
      } else if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        // Horizontal pager swipe (rubber-band at the first/last photo).
        const base = -activeIndex.value * W;
        const atEdge =
          (activeIndex.value === 0 && e.translationX > 0) ||
          (activeIndex.value === count - 1 && e.translationX < 0);
        offsetX.value = base + (atEdge ? e.translationX * 0.25 : e.translationX);
      } else if (e.translationY > 0) {
        // Swipe down to dismiss.
        dismissY.value = e.translationY;
        bg.value = Math.max(0.25, 1 - e.translationY / 500);
      }
    })
    .onEnd((e) => {
      if (scale.value > 1) {
        const maxX = (W * (scale.value - 1)) / 2;
        const maxY = (H * (scale.value - 1)) / 2;
        tx.value = withSpring(clampW(tx.value, -maxX, maxX), { damping: 20 });
        ty.value = withSpring(clampW(ty.value, -maxY, maxY), { damping: 20 });
        return;
      }
      if (dismissY.value > DISMISS_DISTANCE || e.velocityY > 900) {
        runOnJS(onClose)();
        return;
      }
      const far = Math.abs(e.translationX) > W * SWIPE_PAGE_RATIO || Math.abs(e.velocityX) > 500;
      if (far && Math.abs(e.translationX) > Math.abs(e.translationY)) {
        goTo(activeIndex.value + (e.translationX < 0 ? 1 : -1));
      } else {
        settlePager();
      }
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: bg.value }));
  const containerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dismissY.value }] }));
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offsetX.value }] }));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />

        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.fill, containerStyle]}>
            <Animated.View style={[styles.row, { width: W * count }, rowStyle]}>
              {images.map((uri, i) => (
                <Page key={`${i}-${uri}`} uri={uri} i={i} w={W} h={H} activeIndex={activeIndex} scale={scale} tx={tx} ty={ty} />
              ))}
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>

        {count > 1 ? (
          <View style={styles.counter} pointerEvents="none">
            <Text style={styles.counterText}>
              {active + 1} / {count}
            </Text>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

/** One full-screen page. Zoom transforms apply only when it's the active page. */
function Page({
  uri,
  i,
  w,
  h,
  activeIndex,
  scale,
  tx,
  ty,
}: {
  uri: string;
  i: number;
  w: number;
  h: number;
  activeIndex: { value: number };
  scale: { value: number };
  tx: { value: number };
  ty: { value: number };
}): React.JSX.Element {
  const style = useAnimatedStyle(() => {
    const on = activeIndex.value === i;
    return {
      transform: [
        { translateX: on ? tx.value : 0 },
        { translateY: on ? ty.value : 0 },
        { scale: on ? scale.value : 1 },
      ],
    };
  });

  return (
    <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.Image source={{ uri }} style={[{ width: w, height: h }, style]} resizeMode="contain" />
    </View>
  );
}

/** Access the global lightbox. Must be used under <LightboxProvider>. */
export function useLightbox(): LightboxContextValue {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error('useLightbox must be used within a LightboxProvider');
  return ctx;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  backdrop: { backgroundColor: '#000000' },
  row: { flexDirection: 'row', height: '100%' },
  close: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  counterText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
