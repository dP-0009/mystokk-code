import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import type { MainTabParamList } from './index';

import { DashboardScreen } from '../screens/DashboardScreen';
import { InventoryListScreen } from '../screens/InventoryListScreen';
import { NetworkScreen } from '../screens/NetworkScreen';
import { ReceivedListScreen } from '../screens/ReceivedListScreen';
import { ReservationsScreen } from '../screens/ReservationsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Main app routes: Dashboard, Inventory, Network, Received, Reservations.
 *
 * The bottom tab bar is hidden — navigation happens through the persistent
 * sidebar that each screen renders via `<MainLayout>`. The tab navigator is
 * retained purely as the route container (deep links, params, history).
 */
export function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Inventory" component={InventoryListScreen} />
      <Tab.Screen name="Network" component={NetworkScreen} />
      <Tab.Screen name="Received" component={ReceivedListScreen} />
      <Tab.Screen name="Reservations" component={ReservationsScreen} />
    </Tab.Navigator>
  );
}
