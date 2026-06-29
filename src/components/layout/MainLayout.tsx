import React, { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import type { MainTabParamList, RootStackParamList } from '../../navigation';
import { getDashboardData } from '../../services/supabase/dashboard';
import { useReservationAttention } from '../../hooks/useReservationAttention';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuthStore } from '../../stores/authStore';
import { colors } from '../../theme/tokens';
import { AppShell } from './AppShell';
import { Sidebar } from './Sidebar';
import { SidebarNav, type SidebarNavId } from './SidebarNav';
import { SidebarFooter } from './SidebarFooter';
import { NotificationBell } from './NotificationBell';
import { ProfileMenu } from './ProfileMenu';
import { MobileTopBar } from './MobileTopBar';
import { MobileTabBar } from './MobileTabBar';
import { MobileMenuSheet } from './MobileMenuSheet';
import { webOnly } from './web';

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
  const isMobile = useIsMobile();
  // FIX 5 — clicking the sidebar user block opens this popup (no navigation).
  const [profileOpen, setProfileOpen] = useState(false);
  // Mobile burger sheet.
  const [menuOpen, setMenuOpen] = useState(false);

  // Shares the ['dashboard'] cache with the Dashboard screen — only one fetch
  // per stale window regardless of how many screens mount this layout.
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardData,
    staleTime: 60_000,
  });

  // Pulsing red dot on Reservation Hub when a reservation awaits this vendor.
  const reservationAttention = useReservationAttention();

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
      case 'faq':
        return navigation.navigate('Legal', { page: 'faq' });
      case 'privacy':
        return navigation.navigate('Legal', { page: 'privacy' });
      case 'terms':
        return navigation.navigate('Legal', { page: 'terms' });
      case 'contact':
        return navigation.navigate('Legal', { page: 'contact' });
      default:
        return;
    }
  };

  const sidebar = (
    <Sidebar
      footer={
        <SidebarFooter
          name={data?.vendor.companyName ?? 'MyStokk'}
          email={session?.user?.email ?? ''}
          onPressUser={() => setProfileOpen(true)}
          onPressLink={(link) =>
            navigation.navigate('Legal', {
              page: link.toLowerCase() as 'faq' | 'privacy' | 'terms' | 'contact',
            })
          }
        />
      }
    >
      <SidebarNav
        activeId={active}
        counts={{ inventory: data?.stats.inventory, received: data?.stats.received }}
        reservationAttention={reservationAttention > 0}
        onNavigate={goTo}
      />
    </Sidebar>
  );

  // Mobile chrome — no sidebar; a top app bar + a floating footer nav, with the
  // account/links living in a burger sheet.
  if (isMobile) {
    return (
      <>
        <View style={styles.mobileShell}>
          <MobileTopBar company={data?.vendor.companyName ?? 'MyStokk'} />
          <View style={styles.mobileMain}>{children}</View>
          <MobileTabBar
            activeId={active}
            reservationAttention={reservationAttention > 0}
            menuActive={menuOpen}
            onNavigate={goTo}
            onOpenMenu={() => setMenuOpen(true)}
          />
        </View>
        <MobileMenuSheet
          visible={menuOpen}
          name={data?.vendor.companyName ?? 'MyStokk'}
          email={session?.user?.email ?? ''}
          onClose={() => setMenuOpen(false)}
          onProfile={() => {
            setMenuOpen(false);
            navigation.navigate('Profile');
          }}
          onSettings={() => {
            setMenuOpen(false);
            navigation.navigate('Settings');
          }}
          onNotifications={() => {
            setMenuOpen(false);
            navigation.navigate('Notifications');
          }}
          onLegal={(page) => {
            setMenuOpen(false);
            navigation.navigate('Legal', { page });
          }}
          onLogout={() => {
            setMenuOpen(false);
            void signOut();
          }}
        />
      </>
    );
  }

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
        onNotifications={() => {
          setProfileOpen(false);
          navigation.navigate('Notifications');
        }}
        onLogout={() => {
          setProfileOpen(false);
          void signOut();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // 100dvh (dynamic viewport height) tracks the *visible* area, so the floating
  // footer sits above the mobile browser's bottom toolbar instead of behind it
  // (plain 100vh includes the area under the toolbar). Falls back gracefully on
  // browsers without dvh.
  mobileShell: { flex: 1, flexDirection: 'column', backgroundColor: colors.bgPage, ...webOnly({ minHeight: '100dvh', height: '100dvh' }) },
  mobileMain: { flex: 1, minHeight: 0 },
});
