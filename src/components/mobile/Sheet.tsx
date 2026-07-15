import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';

import { Icon, type IconName } from './Icon';
import { colors, layout, radii, spacing } from './theme';

/**
 * Frosted white-glass background for every sheet/popover. A light BlurView with
 * a translucent white tint on top — frosted, but not so opaque it reads as a
 * plain white card. Shared so all popups look identical.
 */
function FrostedBackground({
  style,
  radius = radii.sheet,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  radius?: number;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={[style, { borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' }]}>
      <BlurView intensity={36} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      {children}
    </View>
  );
}

function SheetBg({ style }: BottomSheetBackgroundProps): React.JSX.Element {
  return <FrostedBackground style={style} />;
}

/**
 * Bottom sheet — frosted white glass, slides from the bottom, backdrop dims the
 * WHOLE screen. Its content clears the floating tab bar so the last row is never
 * hidden behind it. Pickers pass `half` to open pinned to ~half the screen.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  half = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  half?: boolean;
}): React.JSX.Element | null {
  const ref = React.useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (open) ref.current?.expand();
    else ref.current?.close();
  }, [open]);

  if (!open) return null;

  // Clear the floating tab bar (height + its bottom offset + safe area) + margin.
  const bottomClear = insets.bottom + layout.tabBarHeight + 24;

  return (
    <BottomSheet
      ref={ref}
      enablePanDownToClose
      enableDynamicSizing={!half}
      snapPoints={half ? ['55%', '92%'] : undefined}
      index={0}
      onClose={onClose}
      handleIndicatorStyle={styles.grab}
      backgroundComponent={SheetBg}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} pressBehavior="close" />
      )}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.body, { paddingBottom: bottomClear }]}
        keyboardShouldPersistTaps="handled"
      >
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {description ? <Text style={styles.desc}>{description}</Text> : null}
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

/** A tappable row inside a Sheet or Popover (.act). */
export function SheetAction({
  icon,
  label,
  onPress,
  danger = false,
  last = false,
  trailing,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
  trailing?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <View style={[styles.act, !last && styles.actBorder]}>
        <View style={[styles.actIcon, danger && styles.actIconDanger]}>
          <Icon name={icon} size={19} color={danger ? colors.red : colors.blueDark} />
        </View>
        <Text style={[styles.actLabel, danger && styles.actLabelDanger]}>{label}</Text>
        {trailing ?? null}
      </View>
    </Pressable>
  );
}

/**
 * Anchored popover (the avatar menu). Frosted white glass, rendered over an
 * absolute full-screen layer so it overlaps ALL content including the tab bar.
 */
export function Popover({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  if (!open) return null;

  return (
    <View style={styles.popLayer} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, styles.popBg]} onPress={onClose} />
      <FrostedBackground style={[styles.pop, { top: insets.top + 52 }]} radius={26}>
        <View style={styles.popInner}>{children}</View>
      </FrostedBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  tint: { backgroundColor: 'rgba(255,255,255,0.55)' },
  grab: { backgroundColor: 'rgba(15,43,84,0.25)', width: 40, height: 5, borderRadius: 3 },
  body: { paddingHorizontal: spacing.xl },
  title: { fontSize: 19, fontWeight: '800', color: colors.navy, marginTop: 6 },
  desc: { fontSize: 13.5, color: colors.muted, marginTop: 3, marginBottom: 14, lineHeight: 20 },

  act: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, paddingHorizontal: 2 },
  actBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(15,43,84,0.08)' },
  actIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: 'rgba(110,175,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  actIconDanger: { backgroundColor: 'rgba(217,48,48,0.12)' },
  actLabel: { flex: 1, fontSize: 15.5, fontWeight: '700', color: colors.navy },
  actLabelDanger: { color: colors.red },

  // Popover — full-screen layer so it overlaps everything, including the tab bar.
  popLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 },
  popBg: { backgroundColor: 'rgba(10,24,48,0.26)' },
  pop: { position: 'absolute', right: 16, width: 258 },
  popInner: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 8 },
  pressed: { opacity: 0.55 },
});
