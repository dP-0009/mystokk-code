import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandLoader } from '../shared/BrandLoader';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../../navigation';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../../services/supabase/notifications';
import { UNREAD_COUNT_KEY } from '../../hooks/useUnreadCount';
import { colors } from '../../theme/tokens';
import { webOnly } from '../layout/web';
import { toast } from '../../stores/toast';
import { NotificationRow } from './NotificationRow';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * The Main tab a notification should deep-link to, or null when it has no
 * dedicated screen. Callers navigate with their own navigation object via
 * `navigate('Main', { screen: tab })`, avoiding nav-type coupling.
 */
export function notificationTargetTab(type: string): keyof MainTabParamList | null {
  if (type.startsWith('reservation')) return 'Reservations';
  if (type === 'share_received') return 'Received';
  if (type === 'connection_request' || type === 'connection_accepted') return 'Network';
  return null;
}

interface NotificationPopupProps {
  /** Close the popup (e.g. after navigating or clicking outside). */
  onClose: () => void;
  /**
   * True when anchored to the inline (mobile top-bar) bell. The desktop bell is
   * pinned to the viewport edge and insets the popup to clear the scrollbar;
   * the inline bell must hug its anchor (right: 0) or it overflows on phones.
   */
  inline?: boolean;
}

/**
 * Bell dropdown popup (spec STEP 1). Anchored below-right of the bell. Lists
 * recent notifications with a header + "Mark all read", an empty state, and a
 * footer link to the full page. Rows mark-as-read then deep-link by type.
 */
export function NotificationPopup({ onClose, inline = false }: NotificationPopupProps): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    staleTime: 15_000,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
  };

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      invalidate();
      toast.success('All notifications marked as read');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not update notifications.'),
  });

  const items = data ?? [];
  const unread = items.filter((n) => !n.read).length;

  const openNotification = async (n: AppNotification): Promise<void> => {
    onClose();
    try {
      if (!n.read) {
        await markNotificationRead(n.notification_id);
        invalidate();
      }
    } catch {
      // best-effort; still navigate
    }
    const tab = notificationTargetTab(n.type);
    if (tab) navigation.navigate('Main', { screen: tab });
  };

  return (
    <View style={[styles.popup, inline ? styles.popupInline : null]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable
          onPress={() => markAll.mutate()}
          disabled={unread === 0 || markAll.isPending}
          hitSlop={6}
          testID="popup-mark-all"
        >
          <Text style={[styles.markAll, unread === 0 ? styles.markAllDisabled : null]}>Mark all read</Text>
        </Pressable>
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={styles.center}>
          <BrandLoader mode="loop" size={90} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {items.map((n, i) => (
            <NotificationRow
              key={n.notification_id}
              item={n}
              last={i === items.length - 1}
              onPress={() => void openNotification(n)}
            />
          ))}
        </ScrollView>
      )}

      {/* Footer — reach the full page */}
      <Pressable
        style={styles.footer}
        onPress={() => {
          onClose();
          navigation.navigate('Notifications');
        }}
        testID="popup-view-all"
      >
        <Text style={styles.footerText}>View all notifications</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: 'absolute',
    top: '100%',
    // Inset from the viewport edge so the dropdown clears the scrollbar and
    // lines up under the bell (matches the bell anchor's paddingRight). The
    // bell's padding doesn't move this — the offset is relative to the anchor's
    // padding box, whose right edge sits at the viewport edge.
    right: 40,
    // 8px gap below the bell — i.e. top: calc(100% + 8px).
    marginTop: 8,
    width: 340,
    // Never overflow a narrow (mobile) viewport.
    ...webOnly({ maxWidth: 'calc(100vw - 24px)' }),
    maxHeight: 420,
    backgroundColor: colors.bgWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border, // #E2E8F0
    overflow: 'hidden',
    zIndex: 9999,
    // 0 8px 32px rgba(0,0,0,0.15)
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 16,
  },
  // Inline (mobile) bell: hug the anchor so the popup doesn't overflow the screen.
  popupInline: { right: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  markAll: { fontSize: 12, fontWeight: '600', color: colors.accent, ...webOnly({ cursor: 'pointer' }) },
  markAllDisabled: { color: colors.textMuted },

  list: { flexShrink: 1 },
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 13, color: colors.textMuted },

  footer: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgWhite,
    ...webOnly({ cursor: 'pointer' }),
  },
  footerText: { fontSize: 13, fontWeight: '600', color: colors.accent },
});
