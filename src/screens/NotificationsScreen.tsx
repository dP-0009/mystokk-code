import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { NotificationRow } from '../components/notifications/NotificationRow';
import { notificationTargetTab } from '../components/notifications/NotificationPopup';
import { MainLayout, PageBody } from '../components/layout';
import { EmptyState } from '../components/shared/EmptyState';
import { ErrorState, LoadingState } from '../components/shared/StateView';
import { webOnly } from '../components/layout/web';
import { colors } from '../theme/tokens';
import { toast } from '../stores/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

type Tab = 'all' | 'unread';

export function NotificationsScreen({ navigation }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    staleTime: 15_000,
  });

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

  const openNotification = async (n: AppNotification): Promise<void> => {
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
    <MainLayout>
      {/* Page header (mirror `.ph`) — extra right padding clears the fixed bell. */}
      <View style={styles.header}>
        <Text style={styles.h1}>Notifications</Text>
        <Pressable
          onPress={() => markAll.mutate()}
          disabled={unread === 0 || markAll.isPending}
          hitSlop={6}
          testID="notifications-mark-all"
          style={webOnly({ cursor: unread === 0 ? 'default' : 'pointer' })}
        >
          <Text style={[styles.markAll, unread === 0 ? styles.markAllDisabled : null]}>Mark all as read</Text>
        </Pressable>
      </View>

      <PageBody>
        {/* Tabs — underline style */}
        <View style={styles.tabs}>
          <TabButton label="All" active={tab === 'all'} onPress={() => setTab('all')} />
          <TabButton
            label={unread > 0 ? `Unread (${unread})` : 'Unread'}
            active={tab === 'unread'}
            onPress={() => setTab('unread')}
          />
        </View>

        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState
            message={error instanceof Error ? error.message : 'Failed to load.'}
            onRetry={() => void refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="🔔"
            title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            message="Alerts about shares, reservations, and your network show up here."
          />
        ) : (
          <View style={styles.card}>
            {items.map((n, i) => (
              <NotificationRow
                key={n.notification_id}
                item={n}
                last={i === items.length - 1}
                onPress={() => void openNotification(n)}
              />
            ))}
          </View>
        )}
      </PageBody>
    </MainLayout>
  );
}

/** Underline tab — active gets a 2px #2563EB bottom border + blue text. */
function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable style={[styles.tab, active ? styles.tabActive : null]} onPress={onPress}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // `.ph` — title left, action right. Extra right padding clears the fixed bell.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingLeft: 28,
    paddingRight: 64,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: colors.bgWhite,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  h1: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },

  markAll: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  markAllDisabled: { color: colors.textMuted },

  // Underline tab strip — bottom border separates tabs from the list.
  tabs: {
    flexDirection: 'row',
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1, // overlap the strip's border so the active underline sits on it
    ...webOnly({ cursor: 'pointer' }),
  },
  tabActive: { borderBottomColor: colors.accent }, // #2563EB
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.accent }, // #2563EB

  card: {
    backgroundColor: colors.bgWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

});
