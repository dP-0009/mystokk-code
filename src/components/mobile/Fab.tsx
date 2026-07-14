import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassPanel } from './GlassPanel';
import { Icon, type IconName } from './Icon';
import { colors, glass, layout, radii } from './theme';

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
        <Animated.View style={[styles.menuWrap, { opacity: anim }]} pointerEvents="box-none">
          <GlassPanel effect="regular" radius={radii.crow} fill={glass.fillFabMenu} style={styles.menu}>
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
          </GlassPanel>
        </Animated.View>
      ) : null}

      <Pressable onPress={toggle} style={({ pressed }) => [styles.fabWrap, pressed && styles.pressedFab]}>
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
  fabWrap: { position: 'absolute', right: 18, bottom: 108, zIndex: 46 },
  fab: {
    width: layout.fabSize,
    height: layout.fabSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuWrap: { position: 'absolute', right: 18, bottom: 178, zIndex: 47 },
  menu: { padding: 14, gap: 13, alignItems: 'flex-end' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  itemLabel: { paddingVertical: 9, paddingHorizontal: 15 },
  itemText: { fontSize: 13.5, fontWeight: '800', color: colors.navy },
  mini: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressedFab: { transform: [{ scale: 0.9 }] },
  pressedItem: { opacity: 0.7 },
});
