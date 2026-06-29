import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme/tokens';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import { NotificationPopup } from '../notifications/NotificationPopup';
import { webOnly } from './web';

type NotificationBellProps = {
  /**
   * Override the unread count. Defaults to the live `useUnreadCount()` hook;
   * pass a value to render the bell without the realtime subscription.
   */
  count?: number;
  /**
   * Render inline (e.g. inside the mobile top bar) instead of pinned to the
   * top-right of the viewport.
   */
  inline?: boolean;
};

/**
 * Global notification bell, pinned to the top-right of the viewport. A red dot
 * badge shows the unread count. Clicking it toggles a dropdown popup (not a
 * navigation); the popup closes on outside click or Escape (web).
 */
export function NotificationBell({ count, inline = false }: NotificationBellProps): React.JSX.Element {
  const liveUnread = useUnreadCount();
  const unread = count ?? liveUnread;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<View | null>(null);

  // Close on outside click + Escape (web).
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onDown = (e: MouseEvent): void => {
      const node = anchorRef.current as unknown as HTMLElement | null;
      if (node && e.target instanceof Node && !node.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <View ref={anchorRef} style={[inline ? styles.anchorInline : styles.anchor, open ? styles.anchorOpen : null]}>
      <Pressable
        style={styles.bell}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        testID="notification-bell"
      >
        <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {unread > 99 ? '99+' : unread}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {open ? <NotificationPopup onClose={() => setOpen(false)} inline={inline} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: 0,
    right: 0,
    // Extra right padding nudges the bell in from the very edge (clear of the
    // scrollbar) so it doesn't crowd the corner. Kept in sync with the popup's
    // `right` inset so the dropdown lines up under the bell with the same gap.
    paddingTop: 16,
    paddingRight: 40,
    paddingBottom: 16,
    paddingLeft: 16,
    zIndex: 1000,
    ...webOnly({ position: 'fixed' }),
  },
  // Inline variant — sits in normal flow (e.g. the mobile top bar).
  anchorInline: { position: 'relative', zIndex: 1000 },
  // Lift above page content while the popup is open.
  anchorOpen: { zIndex: 9999 },
  bell: { ...webOnly({ cursor: 'pointer' }) },
  // 16x16 red dot badge, top-right of the icon.
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.bgWhite,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
});
