import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Gallery from 'react-native-awesome-gallery';
import { Ionicons } from '@expo/vector-icons';

/**
 * Full-screen photo viewer — NATIVE, built on react-native-awesome-gallery:
 * pinch-to-zoom, double-tap zoom, pan while zoomed, smooth swipe between photos,
 * and swipe-down to close. No zoom bar, no title. Photos display WHOLE (contain)
 * at intrinsic resolution.
 *
 * Callers pass ORIGINAL image URLs (full public/signed URL, no resize/transform
 * params) so the viewer always shows full quality; list cards keep thumbnails.
 *
 * Same exports/contract as the web Lightbox (LightboxProvider + useLightbox), so
 * Metro swaps this in on native and the web build keeps Lightbox.tsx.
 */

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
  const [current, setCurrent] = useState(index);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* A gesture root inside the Modal — RN Modals render in a separate native
          hierarchy, so awesome-gallery's gestures need their own root here. */}
      <GestureHandlerRootView style={styles.root}>
        <Gallery
          data={images}
          initialIndex={index}
          onSwipeToClose={onClose}
          onIndexChange={setCurrent}
          doubleTapScale={3}
          renderItem={({ item, setImageDimensions }) => (
            <Image
              source={{ uri: item }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              onLoad={(e) => setImageDimensions({ width: e.nativeEvent.source.width, height: e.nativeEvent.source.height })}
            />
          )}
        />

        <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>

        {images.length > 1 ? (
          <View style={styles.counter} pointerEvents="none">
            <Text style={styles.counterText}>
              {current + 1} / {images.length}
            </Text>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Access the global lightbox. Must be used under <LightboxProvider>. */
export function useLightbox(): LightboxContextValue {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error('useLightbox must be used within a LightboxProvider');
  return ctx;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
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
