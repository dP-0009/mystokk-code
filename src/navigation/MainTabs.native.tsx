import React from 'react';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';

import type { MainTabParamList } from './index';
import { getNotifications } from '../services/supabase/notifications';
import { useReservationAttention } from '../hooks/useReservationAttention';
import { TabBar, type TabItem } from '../components/mobile';

import { DashboardScreen } from '../screens/DashboardScreen';
import { InventoryListScreen } from '../screens/InventoryListScreen';
import { NetworkScreen } from '../screens/NetworkScreen';
import { ReceivedListScreen } from '../screens/ReceivedListScreen';
import { ReservationsScreen } from '../screens/ReservationsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * The four tabs, with the prototype's proportional flex weights (rule 7).
 *
 * Network is deliberately absent: rule 8 makes it a pushed screen reached from
 * the Home "My Network" tile. It stays REGISTERED in the navigator below so the
 * /network path and its deep links keep resolving (rule 11) — it just gets no
 * button in the bar.
 */
const TABS: ReadonlyArray<Omit<TabItem, 'badge'> & { route: keyof MainTabParamList }> = [
  { route: 'Dashboard', key: 'Dashboard', label: 'Home', icon: 'home', flex: 0.78 },
  { route: 'Inventory', key: 'Inventory', label: 'My inventory', icon: 'box', flex: 1.08 },
  { route: 'Received', key: 'Received', label: 'Received', icon: 'inbox', flex: 0.88 },
  { route: 'Reservations', key: 'Reservations', label: 'Reservation Hub', icon: 'cal', flex: 1.26 },
];

/**
 * Glass tab bar wired to the existing tab navigator. Badges come from the
 * existing hooks/queries — no new data sources:
 *   Received         → unread `share_received` notifications
 *   Reservation Hub  → useReservationAttention() (awaiting my response)
 */
function GlassTabBar({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const attention = useReservationAttention();
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    staleTime: 15_000,
  });

  const newShares = (notifications ?? []).filter((n) => !n.read && n.type === 'share_received').length;

  const active = state.routes[state.index]?.name ?? 'Dashboard';

  const tabs: TabItem[] = TABS.map((t) => ({
    ...t,
    badge:
      t.route === 'Received' ? newShares : t.route === 'Reservations' ? attention : undefined,
  }));

  return (
    <TabBar
      tabs={tabs}
      value={active}
      onChange={(key) => {
        // `navigate` (not `reset`) so each tab keeps its own state — and so the
        // Network route, which has no button, is never disturbed.
        navigation.navigate(key);
      }}
    />
  );
}

/**
 * Native Main tabs. Same five routes as the web navigator (paths unchanged);
 * only the bar's presentation differs — the web build keeps MainTabs.tsx.
 */
export function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Inventory" component={InventoryListScreen} />
      <Tab.Screen name="Received" component={ReceivedListScreen} />
      <Tab.Screen name="Reservations" component={ReservationsScreen} />
      {/* Registered so /network and its deep links still resolve — but it has no
          tab button, and is reached by pushing from Home's "My Network" tile. */}
      <Tab.Screen
        name="Network"
        component={NetworkScreen}
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
    </Tab.Navigator>
  );
}
