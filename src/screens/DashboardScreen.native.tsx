import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../navigation';
import { getDashboardData, type PendingReservation, type ReceivedItem } from '../services/supabase/dashboard';
import { getNotifications } from '../services/supabase/notifications';
import { notificationTargetTab } from '../components/notifications/NotificationPopup';
import { relativeTime } from '../components/notifications/NotificationRow';
import {
  Badge,
  Button,
  Card,
  Icon,
  Row,
  ScreenBackground,
  SectionLabel,
  StatCard,
  TabHeader,
  Thumb,
  colors,
  spacing,
  useIdentity,
  useTabBarSpace,
} from '../components/mobile';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Dashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;

/** Dot colour for a recent-activity row, by notification type. */
function activityTint(type: string): string {
  if (type === 'reservation_accepted') return colors.green;
  if (type === 'reservation_rejected') return colors.red;
  if (type.startsWith('reservation')) return colors.blue;
  if (type === 'share_received') return colors.violet;
  return colors.muted;
}

/**
 * Home (prototype SCREENS.home). Same data as the web dashboard — the
 * ['dashboard'] query — presented as the mobile design. There is no Quick
 * Actions section (rule: removed), and "My Network" is a tile, not a tab.
 */
export function DashboardScreen({ navigation }: Props): React.JSX.Element {
  const bottomPad = useTabBarSpace();
  const { company, firstName } = useIdentity();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardData,
    staleTime: 60_000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    staleTime: 15_000,
  });

  const pending: PendingReservation | undefined = data?.pending[0];
  const newestShare: ReceivedItem | undefined = data?.received[0];
  const activity = (notifications ?? []).slice(0, 3);
  const hasAttention = Boolean(pending ?? newestShare);

  return (
    <ScreenBackground>
      <TabHeader eyebrow={company} title={firstName ? `Hi, ${firstName}` : 'Welcome'} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.blue} size="large" />
          </View>
        ) : isError || !data ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Failed to load.'}
            </Text>
            <Button label="Retry" variant="ghost" size="sm" onPress={() => void refetch()} />
          </View>
        ) : (
          <>
            {/* 2x2 stat tiles — labels exactly as the prototype. */}
            <View style={styles.tileRow}>
              <StatCard
                icon="box"
                tint={colors.blue}
                tintBg={colors.ice}
                value={data.stats.inventory}
                label="My Inventory"
                onPress={() => navigation.navigate('Inventory')}
              />
              <StatCard
                icon="inbox"
                tint={colors.green}
                tintBg={colors.greenBg}
                value={data.stats.received}
                label="Received Inventory"
                onPress={() => navigation.navigate('Received')}
              />
            </View>
            <View style={[styles.tileRow, styles.tileRowGap]}>
              <StatCard
                icon="cal"
                tint={colors.violet}
                tintBg={colors.violetBg}
                value={data.stats.reservations}
                label="Reservation Hub"
                onPress={() => navigation.navigate('Reservations')}
              />
              <StatCard
                icon="net"
                tint={colors.amber}
                tintBg={colors.amberBg}
                value={data.stats.network}
                label="My Network"
                // Network is NOT a bottom tab (rule 8) — it's reached from here.
                onPress={() => navigation.navigate('Network')}
              />
            </View>

            {/* Needs your attention */}
            {hasAttention ? (
              <>
                <View style={styles.sectionRow}>
                  <SectionLabel>Needs your attention</SectionLabel>
                  <Pressable onPress={() => navigation.navigate('Reservations')} hitSlop={6}>
                    <Text style={styles.viewAll}>View all</Text>
                  </Pressable>
                </View>

                {pending ? (
                  <Row
                    leading={<Thumb name={pending.item_title} size={52} />}
                    title={`${pending.requester_company ?? 'A vendor'} wants to reserve ${pending.item_title}`}
                    subtitle={reservationSubtitle(pending)}
                    trailing={<Badge label="Pending" tone="amber" />}
                    clamp
                    onPress={() => navigation.navigate('Reservations')}
                  />
                ) : null}

                {newestShare ? (
                  <Row
                    leading={<Thumb name={newestShare.title} size={52} />}
                    title={`${newestShare.shared_by_company_name ?? 'A vendor'} shared ${newestShare.title}`}
                    subtitle={relativeTime(newestShare.created_at)}
                    trailing={<Badge label="New" tone="blue" />}
                    clamp
                    onPress={() =>
                      navigation.navigate('ReceivedDetail', { shareId: newestShare.share_id })
                    }
                  />
                ) : null}
              </>
            ) : null}

            {/* Recent activity */}
            {activity.length > 0 ? (
              <>
                <SectionLabel>Recent activity</SectionLabel>
                <Card style={styles.activityCard}>
                  {activity.map((n, i) => (
                    <Pressable
                      key={n.notification_id}
                      onPress={() => {
                        const tab = notificationTargetTab(n.type);
                        if (tab) navigation.navigate(tab);
                      }}
                      style={[styles.activityRow, i < activity.length - 1 && styles.activityBorder]}
                    >
                      <View style={[styles.activityDot, { backgroundColor: activityTint(n.type) }]} />
                      <View style={styles.activityBody}>
                        <Text style={styles.activityTitle} numberOfLines={2}>
                          {n.title}
                        </Text>
                        <Text style={styles.activityTime}>{relativeTime(n.created_at)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </Card>
              </>
            ) : null}

            {!hasAttention && activity.length === 0 ? (
              <View style={styles.quiet}>
                <Icon name="check" size={28} color={colors.green} />
                <Text style={styles.quietText}>Nothing needs your attention right now.</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

/** "50 unit · offered AED 40,000" — omits the offer when none was made. */
function reservationSubtitle(p: PendingReservation): string {
  const qty = `${p.quantity.toLocaleString()} unit`;
  if (p.offered_price === null) return qty;
  return `${qty} · offered ${p.item_currency} ${p.offered_price.toLocaleString()}`;
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter, paddingTop: 18 },
  center: { paddingVertical: 80, alignItems: 'center', gap: 14 },
  errorText: { color: colors.muted, fontSize: 14, textAlign: 'center' },

  tileRow: { flexDirection: 'row', gap: 11 },
  tileRowGap: { marginTop: 11 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewAll: { fontSize: 12.5, fontWeight: '700', color: colors.blue },

  activityCard: { paddingVertical: 5, paddingHorizontal: 15 },
  activityRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12.5 },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  activityBody: { flex: 1, minWidth: 0 },
  activityTitle: { fontSize: 14, fontWeight: '600', color: colors.navy, lineHeight: 19 },
  activityTime: { fontSize: 12, color: colors.muted, marginTop: 3 },

  quiet: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  quietText: { fontSize: 13.5, color: colors.muted },
});
