import React, { useState, type ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import type { MainTabParamList, RootStackParamList } from '../../navigation';
import { getDashboardData } from '../../services/supabase/dashboard';
import { useAuthStore } from '../../stores/authStore';
import { AppShell } from './AppShell';
import { Sidebar } from './Sidebar';
import { SidebarNav, type SidebarNavId } from './SidebarNav';
import { SidebarFooter } from './SidebarFooter';
import { NotificationBell } from './NotificationBell';
import { ProfileMenu } from './ProfileMenu';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type MainLayoutProps = {
  /** Which sidebar item is highlighted for this screen. Omit for screens with
   *  no sidebar entry (e.g. Notifications) so nothing is highlighted. */
  active?: SidebarNavId;
  /** Page content — typically `<PageHeader/>` + `<PageBody/>`. */
  children: ReactNode;
};

/**
 * The persistent authenticated chrome: sidebar + notification bell wrapped
 * around a screen's content. Rendered once per main screen (the bottom tab bar
 * is hidden), so every page shares one consistent sidebar without each screen
 * re-assembling it. Counts + the footer identity come from the cached
 * dashboard query, shared across screens.
 */
export function MainLayout({ active, children }: MainLayoutProps): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  // FIX 5 — clicking the sidebar user block opens this popup (no navigation).
  const [profileOpen, setProfileOpen] = useState(false);

  // Shares the ['dashboard'] cache with the Dashboard screen — only one fetch
  // per stale window regardless of how many screens mount this layout.
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardData,
    staleTime: 60_000,
  });

  const goTo = (id: SidebarNavId): void => {
    // Route the tab destinations through `Main` so the sidebar works from any
    // context — including root-stack screens (e.g. Add Item) where the bare tab
    // names aren't directly resolvable from the current navigator.
    switch (id) {
      case 'dashboard':
        return navigation.navigate('Main', { screen: 'Dashboard' });
      case 'inventory':
        return navigation.navigate('Main', { screen: 'Inventory' });
      case 'received':
        return navigation.navigate('Main', { screen: 'Received' });
      case 'reservations':
        return navigation.navigate('Main', { screen: 'Reservations' });
      case 'network':
        return navigation.navigate('Main', { screen: 'Network' });
      case 'settings':
        return navigation.navigate('Settings');
      default:
        return; // faq / privacy / terms / contact — no route yet
    }
  };

  const sidebar = (
    <Sidebar
      footer={
        <SidebarFooter
          name={data?.vendor.companyName ?? 'MyStokk'}
          email={session?.user?.email ?? ''}
          onPressUser={() => setProfileOpen(true)}
        />
      }
    >
      <SidebarNav
        activeId={active}
        counts={{ inventory: data?.stats.inventory, received: data?.stats.received }}
        onNavigate={goTo}
      />
    </Sidebar>
  );

  return (
    <>
      <AppShell sidebar={sidebar}>{children}</AppShell>
      <NotificationBell />
      <ProfileMenu
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSettings={() => {
          setProfileOpen(false);
          navigation.navigate('Settings');
        }}
        onLogout={() => {
          setProfileOpen(false);
          void signOut();
        }}
        fallbackName={data?.vendor.companyName ?? undefined}
        fallbackEmail={session?.user?.email ?? ''}
      />
    </>
  );
}
