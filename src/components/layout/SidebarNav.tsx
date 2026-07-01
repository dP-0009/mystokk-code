import React from 'react';
import { Ionicons } from '@expo/vector-icons';

import { NavItem } from './NavItem';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Stable id for each sidebar destination — also the active-state key. */
export type SidebarNavId =
  | 'dashboard'
  | 'inventory'
  | 'received'
  | 'reservations'
  | 'network'
  | 'settings'
  | 'faq'
  | 'privacy'
  | 'terms'
  | 'contact';

type NavEntry = {
  id: SidebarNavId;
  label: string;
  icon: IoniconName;
  /** Which count (if any) backs this item's blue badge pill. */
  badge?: 'inventory' | 'received';
};

/** Primary sidebar destinations. Account/legal links live in the account menu
 *  (opened from the footer identity), not the nav rail. */
const NAV_ITEMS: readonly NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { id: 'inventory', label: 'My Inventory', icon: 'cube-outline', badge: 'inventory' },
  { id: 'received', label: 'Received Inventory', icon: 'file-tray-outline', badge: 'received' },
  { id: 'reservations', label: 'Reservation Hub', icon: 'calendar-outline' },
  { id: 'network', label: 'My Network', icon: 'people-outline' },
];

type SidebarNavProps = {
  /** The currently active destination, highlighted in blue. */
  activeId?: SidebarNavId;
  /** Counts feeding the My Inventory / Received Inventory badge pills. */
  counts?: { inventory?: number; received?: number };
  /** When true, the Reservation Hub item shows a pulsing red attention dot. */
  reservationAttention?: boolean;
  /** Fired with the tapped item's id — wire to navigation. */
  onNavigate?: (id: SidebarNavId) => void;
};

/**
 * The sidebar's nav list. Presentational + decoupled from routing: the parent
 * supplies the active id, the badge counts, and the navigation handler.
 */
export function SidebarNav({
  activeId,
  counts,
  reservationAttention,
  onNavigate,
}: SidebarNavProps): React.JSX.Element {
  return (
    <>
      {NAV_ITEMS.map((entry) => (
        <NavItem
          key={entry.id}
          icon={entry.icon}
          label={entry.label}
          active={entry.id === activeId}
          badge={entry.badge ? counts?.[entry.badge] : undefined}
          dot={entry.id === 'reservations' ? reservationAttention : undefined}
          onPress={() => onNavigate?.(entry.id)}
        />
      ))}
    </>
  );
}
