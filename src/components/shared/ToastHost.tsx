import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useToast, type ToastItem, type ToastVariant } from '../../stores/toast';
import { colors } from '../../theme/tokens';
import { webOnly } from '../layout/web';

const VISIBLE_MS = 3000; // auto-dismiss after exactly 3 seconds
const IN_MS = 220;
const OUT_MS = 200;

const VARIANT_ICON: Record<ToastVariant, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { name: 'checkmark-circle', color: colors.green },
  error: { name: 'close-circle', color: colors.red },
  info: { name: 'information-circle', color: colors.accent },
  delete: { name: 'trash', color: colors.red },
};

/**
 * App-wide toast overlay. Mount once near the app root, above the navigator.
 * Renders the toast stack pinned to the bottom-right; each toast slides in from
 * the right, auto-dismisses after 3s, and can be closed immediately via its ✕.
 */
export function ToastHost(): React.JSX.Element | null {
  const toasts = useToast((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      {toasts.map((t) => (
        <ToastRow key={t.id} item={t} />
      ))}
    </View>
  );
}

function ToastRow({ item }: { item: ToastItem }): React.JSX.Element {
  const dismiss = useToast((s) => s.dismiss);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(40)).current;
  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    // Slide in from the right + fade in.
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: IN_MS, useNativeDriver: useNative }),
      Animated.timing(translateX, { toValue: 0, duration: IN_MS, useNativeDriver: useNative }),
    ]).start();

    const close = (): void => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: OUT_MS, useNativeDriver: useNative }),
        Animated.timing(translateX, { toValue: 40, duration: OUT_MS, useNativeDriver: useNative }),
      ]).start(({ finished }) => {
        if (finished) dismiss(item.id);
      });
    };

    const timer = setTimeout(close, VISIBLE_MS);
    return () => clearTimeout(timer);
    // Run once per toast — its id is stable for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // ✕ closes immediately (no exit animation wait).
  const onClose = (): void => dismiss(item.id);

  const icon = VARIANT_ICON[item.variant];

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateX }] }]} pointerEvents="auto">
      <Ionicons name={icon.name} size={18} color={icon.color} />
      <Text style={styles.text} numberOfLines={3}>
        {item.message}
      </Text>
      <Pressable onPress={onClose} hitSlop={8} style={styles.close} accessibilityLabel="Dismiss notification">
        <Ionicons name="close" size={16} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Pinned bottom-right, above everything. Stacks toasts with a 10px gap.
  host: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    gap: 10,
    alignItems: 'flex-end',
    zIndex: 9999,
    ...webOnly({ position: 'fixed' }),
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 240,
    maxWidth: 360,
    backgroundColor: colors.primary, // #0F172A
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  text: { flex: 1, color: colors.bgWhite, fontSize: 13, fontWeight: '500' },
  close: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
});
