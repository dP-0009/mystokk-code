import React, { useState, type ReactNode } from 'react';
import { Image, Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '../../theme/tokens';

interface ProductImageProps {
  uri: string | null | undefined;
  /** Fixed box size — set both to prevent layout shift (CLS). */
  width: number;
  height: number;
  borderRadius?: number;
  /** Rendered when there is no `uri` (e.g. a cube icon). */
  fallback?: ReactNode;
  style?: ViewStyle;
}

/**
 * Fixed-size product image with a shimmer placeholder while it loads.
 *
 * - Fixed width/height → no layout shift (CLS).
 * - `resizeMode="cover"` → object-fit: cover.
 * - While loading, shows the animated grey `.skeleton` pulse (web; a static
 *   tint on native). Falls back to `fallback` when there's no image.
 */
export function ProductImage({
  uri,
  width,
  height,
  borderRadius = 0,
  fallback,
  style,
}: ProductImageProps): React.JSX.Element {
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={[{ width, height, borderRadius }, styles.box, style]}>
      {uri ? (
        <>
          {!loaded ? <Skeleton /> : null}
          {Platform.OS === 'web' ? (
            // Real <img> so the browser can lazy-load below-the-fold thumbnails
            // and decode them off the main thread. react-native-web's <Image>
            // renders a background-image div, which can't do native lazy-load.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            React.createElement('img' as any, {
              src: uri,
              loading: 'lazy',
              decoding: 'async',
              alt: '',
              onLoad: () => setLoaded(true),
              style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
            })
          ) : (
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onLoadEnd={() => setLoaded(true)}
            />
          )}
        </>
      ) : (
        fallback ?? null
      )}
    </View>
  );
}

/** Absolute-fill shimmer pulse. Uses the global `.skeleton` CSS gradient on web
 * (no inline background, so it isn't overridden); a flat tint on native. */
function Skeleton(): React.JSX.Element {
  if (Platform.OS === 'web') {
    // react-native-web forwards `className` to the DOM node.
    return <View {...({ className: 'skeleton' } as unknown as object)} style={StyleSheet.absoluteFill} />;
  }
  return <View style={[StyleSheet.absoluteFill, styles.skeletonNative]} />;
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    backgroundColor: colors.bgChip, // #F1F5F9
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Native fallback tint (no CSS keyframes off the web).
  skeletonNative: { backgroundColor: colors.bgChip },
});
