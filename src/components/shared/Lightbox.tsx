import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { webOnly } from '../layout/web';

const SWIPE_THRESHOLD = 50;

interface LightboxProps {
  visible: boolean;
  images: string[];
  /** Index to open on. */
  index?: number;
  onClose: () => void;
  /** Show the thumbnail strip (carousel mode). Defaults to true. */
  showThumbnails?: boolean;
}

/**
 * Full-screen image viewer (mirror spec). Single-image or carousel (when
 * `images.length > 1`). Closes on the ✕ button, Escape, or clicking the dark
 * area outside the image. Arrow keys + swipe navigate; a counter and optional
 * thumbnail strip sit at the bottom. Use via `useLightbox().open(...)`.
 */
export function Lightbox({
  visible,
  images,
  index = 0,
  onClose,
  showThumbnails = true,
}: LightboxProps): React.JSX.Element | null {
  const [current, setCurrent] = useState(index);
  const count = images.length;
  const isCarousel = count > 1;

  // Re-seed the active index whenever the lightbox (re)opens at a new index.
  useEffect(() => {
    if (visible) setCurrent(index);
  }, [visible, index]);

  const go = useCallback(
    (dir: 1 | -1) => {
      setCurrent((c) => (count === 0 ? 0 : (c + dir + count) % count));
    },
    [count],
  );

  // Keyboard: Escape closes, ←/→ navigate (web only).
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      else if (isCarousel && e.key === 'ArrowLeft') go(-1);
      else if (isCarousel && e.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, isCarousel, go, onClose]);

  // Swipe left/right on touch devices.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > SWIPE_THRESHOLD) go(-1);
        else if (g.dx < -SWIPE_THRESHOLD) go(1);
      },
    }),
  ).current;

  if (!visible || count === 0) return null;

  const uri = images[Math.min(current, count - 1)];

  return (
    <View style={styles.overlay}>
      {/* Backdrop — clicking the dark area (outside the image) closes. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close image viewer" />

      {/* Close button */}
      <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Close">
        <Ionicons name="close" size={20} color="#FFFFFF" />
      </Pressable>

      {/* Prev / Next arrows (carousel only) */}
      {isCarousel ? (
        <>
          <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => go(-1)} accessibilityLabel="Previous image">
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </Pressable>
          <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => go(1)} accessibilityLabel="Next image">
            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </Pressable>
        </>
      ) : null}

      {/* Column: image area (flex) over the controls — they never overlap, so a
          tall image is shown whole (contain) between the top close and the
          bottom strip. box-none lets clicks on the empty margins reach the
          backdrop (close); the image + controls keep their own taps. */}
      <View style={styles.content} pointerEvents="box-none">
        <View style={styles.imageArea} pointerEvents="box-none">
          <View style={styles.imageWrap} {...pan.panHandlers}>
            {Platform.OS === 'web' ? (
              // On web, render a real <img>: react-native-web's <Image> is a
              // background-image <div>, which collapses to 0px when sized
              // auto/auto. A native <img> with object-fit: contain sizes
              // correctly. (uri is a full https:// URL — see storage.ts.)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              React.createElement('img' as any, { src: uri, style: WEB_IMG_STYLE, alt: '' })
            ) : (
              <Image source={{ uri }} style={styles.nativeImage} resizeMode="contain" />
            )}
          </View>
        </View>

        {/* Counter + thumbnail strip (carousel only) — in normal flow below the
            image so they never cover it. */}
        {isCarousel ? (
          <View style={styles.bottom} pointerEvents="box-none">
            <Text style={styles.counter}>
              {current + 1} / {count}
            </Text>
            {showThumbnails ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbStrip}
              >
                {images.map((thumb, i) => (
                  <Pressable
                    key={`${i}-${thumb}`}
                    onPress={() => setCurrent(i)}
                    style={[styles.thumb, i === current ? styles.thumbActive : null]}
                    accessibilityLabel={`View image ${i + 1}`}
                  >
                    <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Global provider + hook — mount <LightboxProvider> once near the app
 * root; call useLightbox().open(images, index) from anywhere.
 * ------------------------------------------------------------------ */
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
      <Lightbox
        visible={state !== null}
        images={state?.images ?? []}
        index={state?.index ?? 0}
        onClose={close}
      />
    </LightboxContext.Provider>
  );
}

/** Access the global lightbox. Must be used under <LightboxProvider>. */
export function useLightbox(): LightboxContextValue {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error('useLightbox must be used within a LightboxProvider');
  return ctx;
}

const CIRCLE = 'rgba(255,255,255,0.15)';

// Web-only <img> sizing: fill the width, keep aspect ratio, cap height, and
// contain so the whole photo is visible inside the dark overlay. Plain CSS
// (not RN style) because this is a real DOM <img>, not an RN <Image>.
const WEB_IMG_STYLE = {
  width: 'auto',
  height: 'auto',
  // Leave room for the top close button and the bottom counter/thumbnail strip
  // so a tall image is never cropped or hidden behind the controls.
  maxWidth: '92vw',
  maxHeight: 'calc(100vh - 210px)',
  objectFit: 'contain',
  display: 'block',
  borderRadius: 8,
} as const;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    ...webOnly({ position: 'fixed' }),
  },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  close: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...webOnly({ cursor: 'pointer' }),
  },

  arrow: {
    position: 'absolute',
    top: '50%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    zIndex: 2,
    ...webOnly({ cursor: 'pointer' }),
  },
  arrowLeft: { left: 20 },
  arrowRight: { right: 20 },

  // Column: image area (flex) above the controls — never overlapping.
  content: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'column' },
  imageArea: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 60 },
  imageWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  nativeImage: { width: '100%', height: '100%' },

  bottom: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    paddingBottom: 20,
    zIndex: 2,
  },
  counter: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  thumbStrip: { gap: 8, paddingHorizontal: 16 },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    ...webOnly({ cursor: 'pointer' }),
  },
  thumbActive: { borderColor: '#FFFFFF' },
  thumbImg: { width: '100%', height: '100%' },
});
