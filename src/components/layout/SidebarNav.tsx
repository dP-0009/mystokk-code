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

/** The 10 sidebar items, in the exact order from the UI mirror / build guide. */
const NAV_ITEMS: readonly NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { id: 'inventory', label: 'My Inventory', icon: 'cube-outline', badge: 'inventory' },
  { id: 'received', label: 'Received Inventory', icon: 'file-tray-outline', badge: 'received' },
  { id: 'reservations', label: 'Reservation Hub', icon: 'calendar-outline' },
  { id: 'network', label: 'My Network', icon: 'people-outline' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline' },
  { id: 'faq', label: 'FAQ', icon: 'help-circle-outline' },
  { id: 'privacy', label: 'Privacy Policy', icon: 'shield-outline' },
  { id: 'terms', label: 'Terms', icon: 'document-text-outline' },
  { id: 'contact', label: 'Contact', icon: 'mail-outline' },
];

type SidebarNavProps = {
  /** The currently active destination, highlighted in blue. */
  activeId?: SidebarNavId;
  /** Counts feeding the My Inventory / Received Inventory badge pills. */
  counts?: { inventory?: number; received?: number };
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
          onPress={() => onNavigate?.(entry.id)}
        />
      ))}
    </>
  );
}
