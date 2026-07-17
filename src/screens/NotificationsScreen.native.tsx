import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MystokkLoader } from '../components/shared/MystokkLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../services/supabase/notifications';
import { UNREAD_COUNT_KEY } from '../hooks/useUnreadCount';
import { usePullRefresh } from '../hooks/usePullRefresh';
import { notificationTargetTab } from '../components/notifications/NotificationPopup';
import { relativeTime } from '../components/notifications/NotificationRow';
import { toast } from '../stores/toast';
import {
  Button,
  EmptyState,
  GlassPanel,
  Icon,
  NavBar,
  ScreenBackground,
  SegmentedControl,
  colors,
  layout,
  radii,
  spacing,
  type IconName,
} from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

/** Glyph + tint per notification type (prototype's tinted icon tiles). */
function styleFor(type: string): { icon: IconName; tint: string } {
  switch (type) {
    case 'share_received':
      return { icon: 'inbox', tint: colors.blue };
    case 'reservation_request':
      return { icon: 'hand', tint: colors.amber };
    case 'reservation_accepted':
      return { icon: 'check', tint: colors.green };
    case 'reservation_rejected':
      return { icon: 'off', tint: colors.red };
    case 'reservation_countered':
      return { icon: 'share', tint: colors.violet };
    case 'connection_request':
    case 'connection_accepted':
      return { icon: 'net', tint: colors.violet };
    default:
      return { icon: 'bell', tint: colors.muted };
  }
}

/** Notifications (prototype SCREENS.notifications) — same data as the web screen. */
export function NotificationsScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<'all' | 'unread'>('all');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    staleTime: 15_000,
  });

  const { control: refreshControl } = usePullRefresh(refetch, insets.top + layout.navHeight - 56);

  useFocusEffect(
    React.useCallback(() => {
      void refetch();
    }, [refetch]),
  );

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

  const all = data ?? [];
  const unread = all.filter((n) => !n.read).length;
  const items = tab === 'unread' ? all.filter((n) => !n.read) : all;

  const open = async (n: AppNotification): Promise<void> => {
    try {
      if (!n.read) {
        await markNotificationRead(n.notification_id);
        invalidate();
      }
    } catch {
      // best-effort; still navigate
    }
    const target = notificationTargetTab(n.type);
    if (target) navigation.navigate('Main', { screen: target });
  };

  return (
    <ScreenBackground>
      <NavBar
        title="Notifications"
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
            hitSlop={6}
            testID="notifications-mark-all"
          >
            {/* Single-line glass pill — never wraps (rule 9). */}
            <GlassPanel effect="clear" radius={radii.pill} style={styles.readAll}>
              <Text
                style={[styles.readAllText, unread === 0 && styles.readAllDisabled]}
                numberOfLines={1}
              >
                Read all
              </Text>
            </GlassPanel>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: layout.bottomPadPlain },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <SegmentedControl
          segments={[
            { key: 'all', label: 'All' },
            { key: 'unread', label: unread > 0 ? `Unread · ${unread}` : 'Unread' },
          ]}
          value={tab}
          onChange={(k) => setTab(k as 'all' | 'unread')}
        />

        {isLoading ? (
          <View style={styles.center}>
            <MystokkLoader showText />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Failed to load.'}
            </Text>
            <Button label="Retry" variant="ghost" size="sm" onPress={() => void refetch()} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon="bell"
            title={tab === 'unread' ? "You're all caught up" : 'No notifications yet'}
            message={
              tab === 'unread'
                ? 'Unread notifications will appear here.'
                : 'Alerts about shares, reservations, and your network show up here.'
            }
          />
        ) : (
          items.map((n) => {
            const { icon, tint } = styleFor(n.type);
            return (
              <Pressable
                key={n.notification_id}
                onPress={() => void open(n)}
                testID={`notification-${n.notification_id}`}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <GlassPanel radius={radii.row} style={styles.row}>
                  <View style={[styles.iconTile, { backgroundColor: `${tint}1A` }]}>
                    <Icon name={icon} size={21} color={tint} />
                  </View>
                  <View style={styles.body}>
                    <Text style={styles.title} numberOfLines={2}>
                      {n.title}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {n.body ? `${n.body} · ` : ''}
                      {relativeTime(n.created_at)}
                    </Text>
                  </View>
                  {!n.read ? <View style={styles.unreadDot} /> : null}
                </GlassPanel>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter },
  // Even padding on all sides; single line, never wrapped (rule 9).
  readAll: { paddingVertical: 8, paddingHorizontal: 14, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  readAllText: { fontSize: 12.5, fontWeight: '800', color: colors.blue },
  readAllDisabled: { color: colors.muted },

  center: { paddingVertical: 80, alignItems: 'center', gap: 14 },
  errorText: { color: colors.muted, fontSize: 14, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  iconTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14.5, fontWeight: '700', color: colors.navy, lineHeight: 19 },
  sub: { fontSize: 12.5, color: colors.muted, marginTop: 2.5 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.red },
  pressed: { transform: [{ scale: 0.985 }] },
});
