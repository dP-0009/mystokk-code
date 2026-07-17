import React from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FrostedFill, FROST_BORDER } from './FrostedBackground';
import { Icon, type IconName } from './Icon';
import { colors, radii, spacing } from './theme';

/**
 * Bottom sheet — plain React Native built-ins only, no third-party sheet or
 * animation libraries. NATIVE ONLY.
 *
 * A transparent RN <Modal> (which natively renders above ALL app UI, including
 * the floating tab bar) holds two children: a full-screen dim backdrop that
 * closes on tap, and a bottom panel with a HARD-CODED half-screen height that
 * cannot be collapsed by any parent's scroll/keyboard container. Slide in/out is
 * the built-in RN Animated API (translateY, ~220ms).
 *
 * The external API (open, onClose, title, description, children, stickyHeader)
 * is unchanged, so every existing consumer works without edits.
 */
const SLIDE_MS = 220;

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  stickyHeader,
  fitContent = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  /** Pinned above the scrolling content (e.g. a picker's search bar). */
  stickyHeader?: React.ReactNode;
  /** Legacy flag — the default sheet opens to half the screen, so this is ignored. */
  half?: boolean;
  /**
   * Size the panel to its CONTENT instead of a fixed half screen, capped at 88%
   * of the screen (beyond which the body scrolls). Use for sheets whose content
   * varies and must show every row (e.g. the vendor detail sheet).
   */
  fitContent?: boolean;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const screenH = Dimensions.get('window').height;
  // Fixed-half height for the default sheets; content-sized sheets instead cap at
  // 88% and let the body scroll. Both are numbers from Dimensions — exact and
  // impossible to collapse (no measured container involved).
  const panelH = Math.round(screenH * 0.5);
  const maxH = Math.round(screenH * 0.88);
  // Off-screen slide distance: for a bottom-anchored panel, translating by the
  // max possible height always moves it fully below the screen.
  const slide = fitContent ? maxH : panelH;

  // Local mount flag so the slide-DOWN finishes before the Modal unmounts.
  const [mounted, setMounted] = React.useState(open);
  const translateY = React.useRef(new Animated.Value(slide)).current;
  const backdrop = React.useRef(new Animated.Value(0)).current;
  // Keyboard lift: raise the whole panel by the keyboard height so its last row
  // (inputs on the Change-password / Delete-account / Import sheets) sits above
  // the keyboard, then drop back when it closes. Combined with the slide so both
  // animate on the same (native-driven) transform.
  const keyboardOffset = React.useRef(new Animated.Value(0)).current;
  const panelTranslate = React.useMemo(
    () => Animated.subtract(translateY, keyboardOffset),
    [translateY, keyboardOffset],
  );

  React.useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates?: { height?: number } }): void => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates?.height ?? 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    };
    const onHide = (): void => {
      Animated.timing(keyboardOffset, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    };
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  // Latest `open` for the close-animation callback, so a fast re-open isn't
  // hidden by a stale "hide me" that lands after it.
  const openRef = React.useRef(open);
  openRef.current = open;

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: SLIDE_MS, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: SLIDE_MS, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: slide, duration: SLIDE_MS, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: SLIDE_MS, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && !openRef.current) setMounted(false);
      });
    }
  }, [open, slide, translateY, backdrop]);

  // Keep the last row clear of the home indicator at the screen bottom.
  const bottomClear = insets.bottom + 20;

  const header =
    title || description ? (
      <>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </>
    ) : null;

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[styles.panel, fitContent ? { maxHeight: maxH } : { height: panelH }, { transform: [{ translateY: panelTranslate }] }]}
        >
          <FrostedFill />

          <View style={styles.grabWrap}>
            <View style={styles.grab} />
          </View>

          {stickyHeader ? (
            <View style={styles.pinned}>
              {header}
              {stickyHeader}
            </View>
          ) : null}

          <ScrollView
            style={fitContent ? styles.scrollFit : undefined}
            contentContainerStyle={[styles.body, { paddingBottom: bottomClear }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {stickyHeader ? null : header}
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
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

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: { backgroundColor: 'rgba(10,24,48,0.5)' },

  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: 1,
    borderColor: FROST_BORDER,
    overflow: 'hidden',
  },

  grabWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  grab: { backgroundColor: 'rgba(15,43,84,0.25)', width: 40, height: 5, borderRadius: 3 },

  body: { paddingHorizontal: spacing.xl },
  // Content-sized panel: the body takes only the space its content needs, but
  // shrinks (and scrolls) once the panel hits its 88% cap.
  scrollFit: { flexGrow: 0, flexShrink: 1 },
  // Pinned region — transparent so it blends into the one continuous frosted
  // surface; only the search input keeps its own pill background.
  pinned: { paddingHorizontal: spacing.xl, backgroundColor: 'transparent', paddingBottom: 8 },
  title: { fontSize: 19, fontWeight: '800', color: colors.navy, marginTop: 6 },
  desc: { fontSize: 13.5, color: colors.muted, marginTop: 3, marginBottom: 14, lineHeight: 20 },

  act: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, paddingHorizontal: 2 },
  actBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(15,43,84,0.08)' },
  actIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: 'rgba(110,175,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  actIconDanger: { backgroundColor: 'rgba(217,48,48,0.12)' },
  actLabel: { flex: 1, fontSize: 15.5, fontWeight: '700', color: colors.navy },
  actLabelDanger: { color: colors.red },

  pressed: { opacity: 0.55 },
});
