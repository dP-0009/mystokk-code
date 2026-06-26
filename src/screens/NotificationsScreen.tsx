import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

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
import { colors } from '../theme/tokens';

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

  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });

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
    const tab = notificationTargetTab(n.type);
    if (tab) navigation.navigate('Main', { screen: tab });
  };

  return (
    <View style={styles.fill}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Pressable
            onPress={() => markAll.mutate()}
            hitSlop={10}
            disabled={unread === 0 || markAll.isPending}
            style={styles.headerSideRight}
            testID="notifications-mark-all"
          >
            <Text style={[styles.markAll, unread === 0 ? styles.markAllDisabled : null]}>Mark all read</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TabButton label="All" active={tab === 'all'} onPress={() => setTab('all')} />
          <TabButton
            label={unread > 0 ? `Unread (${unread})` : 'Unread'}
            active={tab === 'unread'}
            onPress={() => setTab('unread')}
          />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Failed to load.'}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>
            {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
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
        </ScrollView>
      )}
    </View>
  );
}

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
  fill: { flex: 1, backgroundColor: colors.bgPage },
  headerSafe: { backgroundColor: colors.bgWhite, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerSide: { width: 90 },
  headerSideRight: { width: 90, alignItems: 'flex-end' },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  markAll: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  markAllDisabled: { color: colors.textMuted },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  tab: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.bgChip },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.bgWhite },

  list: { flex: 1 },
  listContent: { padding: 16 },
  card: {
    backgroundColor: colors.bgWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted },
});
