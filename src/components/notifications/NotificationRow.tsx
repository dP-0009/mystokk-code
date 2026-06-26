import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppNotification } from '../../services/supabase/notifications';
import { colors } from '../../theme/tokens';
import { webOnly } from '../layout/web';

interface IconStyle {
  icon: string;
  bg: string;
}

/** Emoji + tint background for each notification type. */
export function iconFor(type: string): IconStyle {
  switch (type) {
    case 'share_received':
      return { icon: '📥', bg: colors.greenLight };
    case 'reservation_request':
      return { icon: '🤝', bg: colors.accentLight };
    case 'reservation_accepted':
      return { icon: '✅', bg: colors.greenLight };
    case 'reservation_rejected':
      return { icon: '⛔', bg: colors.redLight };
    case 'reservation_countered':
      return { icon: '💬', bg: colors.orangeLight };
    case 'connection_request':
    case 'connection_accepted':
      return { icon: '👥', bg: colors.purpleLight };
    default:
      return { icon: '🔔', bg: colors.bgChip };
  }
}

/** Compact relative time, e.g. "just now", "5m ago", "3h ago", "2d ago", "1w ago". */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return `${Math.round(day / 7)}w ago`;
}

interface NotificationRowProps {
  item: AppNotification;
  onPress: () => void;
  /** Omit the bottom border on the last row of a list. */
  last?: boolean;
}

/**
 * A single notification row (shared by the bell popup and the full page).
 * Unread rows get a blue left border + faint blue background; read rows are
 * plain white.
 */
export function NotificationRow({ item, onPress, last }: NotificationRowProps): React.JSX.Element {
  const { icon, bg } = iconFor(item.type);
  return (
    <Pressable
      style={[styles.row, item.read ? styles.rowRead : styles.rowUnread, last ? styles.rowLast : null]}
      onPress={onPress}
      testID={`notification-${item.notification_id}`}
    >
      <View style={[styles.icon, { backgroundColor: bg }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.body ? (
          <Text style={styles.message} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border, // #E2E8F0
    // Reserve the 3px left border on every row so read/unread stay aligned.
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    ...webOnly({ cursor: 'pointer' }),
  },
  rowRead: { backgroundColor: colors.bgWhite },
  rowUnread: { backgroundColor: '#F8FBFF', borderLeftColor: colors.accent }, // #2563EB
  rowLast: { borderBottomWidth: 0 },

  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconText: { fontSize: 16 },

  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '600', color: colors.textPrimary }, // #0F172A
  message: { fontSize: 12, color: colors.textSecondary, marginTop: 2 }, // #475569
  time: { fontSize: 11, color: colors.textMuted, marginTop: 4 }, // #94A3B8
});
