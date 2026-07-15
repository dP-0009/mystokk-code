import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useLightbox } from '../shared/Lightbox';
import { Icon } from './Icon';
import { Thumb } from './Avatar';
import { colors } from './theme';

/**
 * Swipeable photo carousel (prototype item/received-detail hero). Real photos,
 * left/right arrows, an "N photos" pill and dot indicators. When there are no
 * photos it shows a monogram tile from `fallbackName`.
 *
 * There is deliberately NO share button here (Phase 4 item 2).
 */
export function PhotoCarousel({
  urls,
  fallbackName,
  height = 268,
}: {
  urls: string[];
  fallbackName: string;
  height?: number;
}): React.JSX.Element {
  const [index, setIndex] = React.useState(0);
  const [width, setWidth] = React.useState(0);
  const scrollRef = React.useRef<ScrollView>(null);
  const { open: openLightbox } = useLightbox();

  const count = urls.length;

  const onLayout = (e: LayoutChangeEvent): void => setWidth(e.nativeEvent.layout.width);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (width <= 0) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const goTo = (next: number): void => {
    const clamped = Math.max(0, Math.min(count - 1, next));
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    setIndex(clamped);
  };

  if (count === 0) {
    return (
      <View style={[styles.wrap, { height }]} onLayout={onLayout}>
        <Thumb name={fallbackName} size={height * 0.6} radius={20} />
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.wrap, { height }]} onLayout={onLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
        >
          {urls.map((uri, i) => (
            <Pressable key={uri} onPress={() => openLightbox(urls, i)}>
              <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>

        {index > 0 ? (
          <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => goTo(index - 1)} hitSlop={6}>
            <Icon name="back" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
        {index < count - 1 ? (
          <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => goTo(index + 1)} hitSlop={6}>
            <Icon name="chev" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}

        <View style={styles.pill}>
          <Icon name="camera" size={14} color="#FFFFFF" />
          <Text style={styles.pillText}>
            {count} photo{count === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {count > 1 ? (
        <View style={styles.dots}>
          {urls.map((u, i) => (
            <View key={u} style={[styles.dot, i === index ? styles.dotOn : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    backgroundColor: '#F0F3F9',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -21,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(88,98,116,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  pill: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(64,74,90,0.78)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  pillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 10, marginBottom: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C9D4E6' },
  dotOn: { width: 18, backgroundColor: colors.blue },
});
