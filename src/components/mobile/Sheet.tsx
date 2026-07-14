import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { GlassPanel } from './GlassPanel';
import { Icon, type IconName } from './Icon';
import { colors, glass, radii, spacing } from './theme';

/**
 * Bottom sheet (.sheet) — the prototype's 8 sheets (reserve, counter, vendor,
 * item actions, filters, bulk import) all land here.
 *
 * Fill is the BRIGHT 0.68 glass: a sheet sits above cards, so a card-weight
 * fill would read as dull. Swipe-to-dismiss and the drag handle come from
 * @gorhom/bottom-sheet.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
}): React.JSX.Element | null {
  const ref = React.useRef<BottomSheet>(null);

  React.useEffect(() => {
    if (open) ref.current?.expand();
    else ref.current?.close();
  }, [open]);

  if (!open) return null;

  return (
    <BottomSheet
      ref={ref}
      enablePanDownToClose
      onClose={onClose}
      index={0}
      handleIndicatorStyle={styles.grab}
      backgroundStyle={styles.sheetBg}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
      )}
    >
      <BottomSheetScrollView contentContainerStyle={styles.body}>
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
 * Anchored popover (.pop) — the avatar menu on the dashboard header. Brighter
 * than a card (0.64) for the same reason sheets are.
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
  if (!open) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, styles.popBg]} onPress={onClose} />
      <GlassPanel effect="regular" radius={30} fill={glass.fillPopover} style={styles.pop}>
        {children}
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: glass.fillSheet,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderWidth: 1,
    borderColor: glass.border,
  },
  grab: { backgroundColor: 'rgba(15,43,84,0.2)', width: 40, height: 5, borderRadius: 3 },
  body: { paddingHorizontal: spacing.xl, paddingBottom: 38 },
  title: { fontSize: 19, fontWeight: '800', color: colors.navy },
  desc: { fontSize: 13.5, color: colors.muted, marginTop: 3, marginBottom: 14, lineHeight: 20 },

  act: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, paddingHorizontal: 2 },
  actBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  actIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: 'rgba(110,175,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actIconDanger: { backgroundColor: 'rgba(217,48,48,0.12)' },
  actLabel: { flex: 1, fontSize: 15.5, fontWeight: '700', color: colors.navy },
  actLabelDanger: { color: colors.red },

  popBg: { backgroundColor: 'rgba(10,24,48,0.26)' },
  pop: { position: 'absolute', top: 106, right: 16, width: 258, paddingHorizontal: 15, paddingTop: 14, paddingBottom: 8 },
  pressed: { opacity: 0.55 },
});
