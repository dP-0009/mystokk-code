import React, { useEffect, useState, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { webOnly } from '../layout/web';
import { colors, radius, shadows } from '../../theme/tokens';

export interface ContextMenuItem {
  /** Leading glyph (emoji), e.g. '👁️'. */
  icon: string;
  label: string;
  danger?: boolean;
  onPress: () => void;
}

interface ContextMenuProps {
  visible: boolean;
  items: ContextMenuItem[];
  onClose: () => void;
  /**
   * Wrapper that contains both the trigger button and this menu. Used on web to
   * detect outside clicks (clicking inside — including the trigger — won't close).
   */
  anchorRef?: RefObject<View | null>;
}

/**
 * Anchored dropdown menu (mirror `.ddm`). Renders absolutely below-right of its
 * trigger. Closes on outside click + Escape (web). Render it as a sibling of the
 * trigger inside a `position: relative` wrapper that holds `anchorRef`.
 */
export function ContextMenu({ visible, items, onClose, anchorRef }: ContextMenuProps): React.JSX.Element | null {
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent): void => {
      const node = anchorRef?.current as unknown as HTMLElement | null;
      if (node && e.target instanceof Node && !node.contains(e.target)) onClose();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [visible, onClose, anchorRef]);

  if (!visible) return null;

  return (
    <View style={styles.menu}>
      {items.map((item, i) => (
        <MenuRow key={item.label} item={item} last={i === items.length - 1} />
      ))}
    </View>
  );
}

function MenuRow({ item, last }: { item: ContextMenuItem; last: boolean }): React.JSX.Element {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      onPress={item.onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={[styles.item, last ? null : styles.itemBorder, hover ? styles.itemHover : null]}
      testID={`ctx-${item.label.toLowerCase()}`}
    >
      <Text style={styles.icon}>{item.icon}</Text>
      <Text style={[styles.label, item.danger ? styles.labelDanger : null]}>{item.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // `.ddm` — floats over content below it; never clipped.
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    minWidth: 160,
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border, // #E2E8F0
    borderRadius: radius.md, // 10
    overflow: 'visible',
    zIndex: 9999,
    ...shadows.dropdown,
  },
  // `.ddi`
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: colors.bgWhite,
    ...webOnly({ cursor: 'pointer' }),
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemHover: { backgroundColor: colors.bgPage },
  icon: { fontSize: 14, width: 18, textAlign: 'center' },
  label: { fontSize: 13, color: colors.textPrimary },
  labelDanger: { color: colors.red },
});
