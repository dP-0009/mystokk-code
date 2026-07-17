import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { FrostedBackground } from './FrostedBackground';
import { GlassPanel } from './GlassPanel';
import { Icon, type IconName } from './Icon';
import { useTabBarSpace } from './TabBar';
import { colors, layout, radii } from './theme';

export interface FabAction {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

/**
 * Floating action button with a speed-dial menu (.fab + .fabmenu).
 *
 * Per the prototype's v7 refinement, the OPEN menu sits on its own bright white
 * glass backing panel (0.62) behind both items — without it the labels are
 * unreadable against busy list content. The + rotates 45° into an ×.
 */
export function FabSpeedDial({ actions }: { actions: FabAction[] }): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const anim = React.useRef(new Animated.Value(0)).current;
  // Float fully ABOVE the tab bar with a 12px gap on every device: useTabBarSpace
  // already resolves to the tab bar's top edge (safe-area inset + gap + height)
  // plus 12px, so a static bottom no longer overlaps the bar on home-indicator
  // devices. The open menu keeps its original 70px offset above the FAB.
  const fabBottom = useTabBarSpace();

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: open ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 70,
    }).start();
  }, [open, anim]);

  const toggle = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOpen((o) => !o);
  };

  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <>
      {open ? (
        <>
          {/* Full-screen catcher: any tap outside the menu closes it (reverse
              animation). Mounted only while open, so the list stays tappable when
              closed. Sits under the menu (47) and FAB (46), over all content. */}
          <Pressable style={styles.catcher} onPress={() => setOpen(false)} />

          <Animated.View style={[styles.menuWrap, { bottom: fabBottom + 70, opacity: anim }]} pointerEvents="box-none">
            <FrostedBackground radius={radii.crow} style={styles.menu}>
              {actions.map((a) => (
              <View key={a.key} style={styles.item}>
                <Pressable
                  onPress={() => {
                    setOpen(false);
                    a.onPress();
                  }}
                  style={({ pressed }) => pressed && styles.pressedItem}
                >
                  <GlassPanel effect="clear" radius={16} style={styles.itemLabel}>
                    <Text style={styles.itemText}>{a.label}</Text>
                  </GlassPanel>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setOpen(false);
                    a.onPress();
                  }}
                  style={({ pressed }) => pressed && styles.pressedItem}
                >
                  <GlassPanel effect="clear" radius={24} style={styles.mini}>
                    <Icon name={a.icon} size={20} color={colors.navy} />
                  </GlassPanel>
                </Pressable>
              </View>
            ))}
            </FrostedBackground>
          </Animated.View>
        </>
      ) : null}

      <Pressable onPress={toggle} style={({ pressed }) => [styles.fabWrap, { bottom: fabBottom }, pressed && styles.pressedFab]}>
        <GlassPanel effect="clear" radius={layout.fabSize / 2} style={styles.fab}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Icon name="plus" size={26} color={colors.navy} />
          </Animated.View>
        </GlassPanel>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  catcher: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 45 },
  fabWrap: { position: 'absolute', right: 18, zIndex: 46 },
  fab: {
    width: layout.fabSize,
    height: layout.fabSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuWrap: { position: 'absolute', right: 18, zIndex: 47 },
  menu: { padding: 14, gap: 13, alignItems: 'flex-end' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  itemLabel: { paddingVertical: 9, paddingHorizontal: 15 },
  itemText: { fontSize: 13.5, fontWeight: '800', color: colors.navy },
  mini: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressedFab: { transform: [{ scale: 0.9 }] },
  pressedItem: { opacity: 0.7 },
});
