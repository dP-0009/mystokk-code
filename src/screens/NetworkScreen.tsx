import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../navigation';
import {
  acceptConnection,
  getNetwork,
  getPendingConnections,
  rejectConnection,
  removeNetworkVendor,
  type NetworkVendor,
  type PendingConnection,
} from '../services/supabase/network';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { LoadingState } from '../components/shared/StateView';
import { AddVendorModal } from '../components/network/AddVendorModal';
import { BulkUploadModal } from '../components/network/BulkUploadModal';
import { ViewVendorModal } from '../components/network/ViewVendorModal';
import { VendorAvatar } from '../components/shared/VendorAvatar';
import { webOnly } from '../components/layout/web';
import { useIsMobile } from '../hooks/useIsMobile';
import { colors, radius, shadows } from '../theme/tokens';
import { openCall, openEmail, openWhatsApp } from '../utils/contact';
import { toast } from '../stores/toast';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Network'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Tab = 'network' | 'pending';

/** A manual contact that hasn't registered yet shows "Manual"; everyone else is "Connected". */
function isManualOnly(v: NetworkVendor): boolean {
  return v.source === 'manual' && !v.is_registered;
}

export function NetworkScreen({ navigation }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>('network');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewVendor, setViewVendor] = useState<NetworkVendor | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<NetworkVendor | null>(null);
  // Mobile: the vendor whose action sheet (call/whatsapp/email/view/edit/delete) is open.
  const [actionVendor, setActionVendor] = useState<NetworkVendor | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const networkQuery = useQuery({ queryKey: ['network'], queryFn: getNetwork, staleTime: 30_000 });
  const pendingQuery = useQuery({
    queryKey: ['network', 'pending'],
    queryFn: getPendingConnections,
    staleTime: 30_000,
  });

  useFocusEffect(
    React.useCallback(() => {
      void networkQuery.refetch();
      void pendingQuery.refetch();
    }, [networkQuery, pendingQuery]),
  );

  // Debounce the search input (300ms), matching the inventory pattern.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const network = networkQuery.data ?? [];
  const pending = pendingQuery.data ?? [];

  const filteredNetwork = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return network;
    return network.filter((v) =>
      [v.company_name, v.contact_person, v.email, v.city, v.country].some((f) =>
        f?.toLowerCase().includes(q),
      ),
    );
  }, [network, search]);

  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter((v) =>
      [v.company_name, v.contact_person, v.email, v.city, v.country].some((f) =>
        f?.toLowerCase().includes(q),
      ),
    );
  }, [pending, search]);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['network'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const acceptMutation = useMutation({
    mutationFn: acceptConnection,
    onSuccess: () => toast.success('Connection accepted!'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not accept request.'),
    onSettled: () => {
      setBusyId(null);
      invalidate();
    },
  });
  const rejectMutation = useMutation({
    mutationFn: rejectConnection,
    onSuccess: () => toast.info('Request declined'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not decline request.'),
    onSettled: () => {
      setBusyId(null);
      invalidate();
    },
  });
  const removeMutation = useMutation({
    mutationFn: (v: NetworkVendor) => removeNetworkVendor(v.source, v.row_id),
    onSuccess: () => {
      setDeleteVendor(null);
      toast.delete('Removed from your network.');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not remove vendor.'),
    onSettled: invalidate,
  });

  const editVendor = (v: NetworkVendor): void =>
    v.source === 'manual'
      ? navigation.navigate('EditVendor', { manualVendorId: v.row_id })
      : navigation.navigate('EditVendor', { vendorId: v.vendor_id ?? undefined });

  const isLoading = networkQuery.isLoading || pendingQuery.isLoading;
  const showPending = tab === 'pending';

  const tabs: ReadonlyArray<{ key: Tab; label: string; count: number }> = [
    { key: 'network', label: 'Network', count: network.length },
    { key: 'pending', label: 'Pending', count: pending.length },
  ];

  return (
    <MainLayout active="network">
      <PageHeader
        title="My Network"
        subtitle={`${network.length} vendor${network.length === 1 ? '' : 's'} in your network`}
      />

      <PageBody>
        {/* Add / Bulk live in the body (right-aligned, below the notification
            bell) rather than inside the white header bar. */}
        <View style={styles.headerActions}>
          <Pressable style={styles.btnPrimary} onPress={() => setAddOpen(true)} testID="network-add-header">
            <Text style={styles.btnPrimaryText}>+ Add</Text>
          </Pressable>
          <Pressable style={styles.btnOutline} onPress={() => setBulkOpen(true)} testID="network-bulk-header">
            <Text style={styles.btnOutlineText}>↑ Bulk</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                style={[styles.tab, active ? styles.tabActive : null]}
                onPress={() => setTab(t.key)}
                testID={`network-tab-${t.key}`}
              >
                <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{t.label}</Text>
                <View style={[styles.tabCount, active ? styles.tabCountActive : null]}>
                  <Text style={[styles.tabCountText, active ? styles.tabCountTextActive : null]}>
                    {t.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={14} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search vendors..."
              placeholderTextColor={colors.textMuted}
              value={searchInput}
              onChangeText={setSearchInput}
              autoCorrect={false}
              testID="network-search"
            />
          </View>
        </View>

        {isMobile ? (
          /* Mobile: stacked cards instead of a wide table. */
          isLoading ? (
            <LoadingState />
          ) : showPending ? (
            filteredPending.length === 0 ? (
              <Text style={styles.empty}>
                {search ? 'No pending requests match your search.' : 'No pending connection requests.'}
              </Text>
            ) : (
              filteredPending.map((p) => (
                <PendingCard
                  key={p.connection_id}
                  item={p}
                  busy={busyId === p.connection_id}
                  onAccept={() => {
                    setBusyId(p.connection_id);
                    acceptMutation.mutate(p.connection_id);
                  }}
                  onReject={() => {
                    setBusyId(p.connection_id);
                    rejectMutation.mutate(p.connection_id);
                  }}
                />
              ))
            )
          ) : filteredNetwork.length === 0 ? (
            <Text style={styles.empty}>
              {search
                ? 'No vendors match your search.'
                : 'No vendors yet — add a vendor or bulk import a CSV.'}
            </Text>
          ) : (
            filteredNetwork.map((v) => (
              <VendorCard
                key={`${v.source}-${v.row_id}`}
                item={v}
                onPress={() => setViewVendor(v)}
                onMenu={() => setActionVendor(v)}
              />
            ))
          )
        ) : (
          /* Desktop: table. */
          <View style={styles.tableCard}>
            <View style={styles.headerRow}>
              <Text style={[styles.th, styles.colCompany]}>Company</Text>
              <Text style={[styles.th, styles.colContact]}>Contact Person</Text>
              <Text style={[styles.th, styles.colCountry]}>Country</Text>
              <Text style={[styles.th, styles.colStatus]}>Status</Text>
              <Text style={[styles.th, styles.colActions]}>Actions</Text>
            </View>

            {isLoading ? (
              <LoadingState />
            ) : showPending ? (
              filteredPending.length === 0 ? (
                <Text style={styles.empty}>
                  {search ? 'No pending requests match your search.' : 'No pending connection requests.'}
                </Text>
              ) : (
                filteredPending.map((p) => (
                  <PendingRow
                    key={p.connection_id}
                    item={p}
                    busy={busyId === p.connection_id}
                    onAccept={() => {
                      setBusyId(p.connection_id);
                      acceptMutation.mutate(p.connection_id);
                    }}
                    onReject={() => {
                      setBusyId(p.connection_id);
                      rejectMutation.mutate(p.connection_id);
                    }}
                  />
                ))
              )
            ) : filteredNetwork.length === 0 ? (
              <Text style={styles.empty}>
                {search
                  ? 'No vendors match your search.'
                  : 'No vendors yet — add a vendor or bulk import a CSV.'}
              </Text>
            ) : (
              filteredNetwork.map((v) => (
                <VendorRow
                  key={`${v.source}-${v.row_id}`}
                  item={v}
                  onView={() => setViewVendor(v)}
                  onEdit={() => editVendor(v)}
                  onDelete={() => setDeleteVendor(v)}
                />
              ))
            )}
          </View>
        )}
      </PageBody>

      <AddVendorModal visible={addOpen} onClose={() => setAddOpen(false)} />
      <BulkUploadModal
        visible={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={() => {
          void networkQuery.refetch();
          void pendingQuery.refetch();
        }}
      />

      {/* Mobile action sheet — the card's ⋮ opens call/whatsapp/email/view/edit/delete. */}
      <Modal
        visible={actionVendor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionVendor(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setActionVendor(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {actionVendor?.company_name}
            </Text>
            {actionVendor?.mobile_number ? (
              <SheetItem
                icon="call-outline"
                color={colors.accent}
                label="Call"
                onPress={() => {
                  const v = actionVendor;
                  setActionVendor(null);
                  openCall(v?.mobile_number ?? null);
                }}
              />
            ) : null}
            {actionVendor?.mobile_number ? (
              <SheetItem
                icon="logo-whatsapp"
                color="#16A34A"
                label="WhatsApp"
                onPress={() => {
                  const v = actionVendor;
                  setActionVendor(null);
                  openWhatsApp(v?.mobile_number ?? null);
                }}
              />
            ) : null}
            {actionVendor?.email ? (
              <SheetItem
                icon="mail-outline"
                color={colors.accent}
                label="Email"
                onPress={() => {
                  const v = actionVendor;
                  setActionVendor(null);
                  openEmail(v?.email ?? null);
                }}
              />
            ) : null}
            <SheetItem
              icon="eye-outline"
              color={colors.textSecondary}
              label="View"
              onPress={() => {
                const v = actionVendor;
                setActionVendor(null);
                if (v) setViewVendor(v);
              }}
            />
            <SheetItem
              icon="pencil-outline"
              color={colors.amber}
              label="Edit"
              onPress={() => {
                const v = actionVendor;
                setActionVendor(null);
                if (v) editVendor(v);
              }}
            />
            <SheetItem
              icon="trash-outline"
              color={colors.red}
              label="Delete"
              onPress={() => {
                const v = actionVendor;
                setActionVendor(null);
                if (v) setDeleteVendor(v);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* View Vendor popup */}
      <ViewVendorModal
        visible={viewVendor !== null}
        vendor={viewVendor}
        onClose={() => setViewVendor(null)}
      />

      {/* Delete confirmation (in-app modal — never the browser confirm) */}
      <Modal
        visible={deleteVendor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteVendor(null)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setDeleteVendor(null)}>
          <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.confirmTitle}>Remove vendor</Text>
            <Text style={styles.confirmBody}>
              {deleteVendor?.company_name} will be removed from your network. This cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmBtn, styles.confirmCancel]}
                onPress={() => setDeleteVendor(null)}
                disabled={removeMutation.isPending}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, styles.confirmDelete, removeMutation.isPending ? styles.confirmBtnDisabled : null]}
                onPress={() => deleteVendor && removeMutation.mutate(deleteVendor)}
                disabled={removeMutation.isPending}
              >
                <Text style={styles.confirmDeleteText}>{removeMutation.isPending ? 'Removing…' : 'Remove'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </MainLayout>
  );
}

/** One connected/manual vendor row, with web hover highlight + inline actions. */
function VendorRow({
  item,
  onView,
  onEdit,
  onDelete,
}: {
  item: NetworkVendor;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  const [hover, setHover] = useState(false);
  const manual = isManualOnly(item);
  // Stop a button press from also triggering the row's onPress (web bubbles).
  const stop = (fn: () => void) => (e: GestureResponderEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <Pressable
      style={[styles.row, hover ? styles.rowHover : null]}
      onPress={onView}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      testID={`network-row-${item.row_id}`}
    >
      <View style={[styles.td, styles.colCompany, styles.companyCell]}>
        <VendorAvatar name={item.company_name} logoUrl={item.logo_url} email={item.email} size={34} />
        <View style={styles.companyText}>
          <Text style={styles.companyName} numberOfLines={1}>
            {item.company_name}
          </Text>
        </View>
      </View>
      <Text style={[styles.td, styles.cellText, styles.colContact]} numberOfLines={1}>
        {item.contact_person || '—'}
      </Text>
      <Text style={[styles.td, styles.cellText, styles.colCountry]} numberOfLines={1}>
        {item.country || '—'}
      </Text>
      <View style={[styles.td, styles.colStatus]}>
        <StatusChip kind={manual ? 'manual' : 'connected'} />
      </View>
      <View style={[styles.td, styles.colActions, styles.actionsCell]}>
        <ActionIcon
          icon="logo-whatsapp"
          color="#FFFFFF"
          bg="#25D366"
          label="WhatsApp"
          onPress={stop(() => openWhatsApp(item.mobile_number))}
          testID={`network-wa-${item.row_id}`}
        />
        <ActionIcon
          icon="mail-outline"
          color="#2563EB"
          bg="#EFF6FF"
          label="Email"
          onPress={stop(() => openEmail(item.email))}
          testID={`network-email-${item.row_id}`}
        />
        <ActionIcon
          icon="eye-outline"
          color="#475569"
          bg="#F1F5F9"
          label="View"
          onPress={stop(onView)}
          testID={`network-view-${item.row_id}`}
        />
        {/* Edit + Delete on every vendor — manual contacts edit fully, connected
            vendors edit their group label; delete removes the contact/connection. */}
        <ActionIcon
          icon="pencil-outline"
          color="#B45309"
          bg="#FFFBEB"
          label="Edit"
          onPress={stop(onEdit)}
          testID={`network-edit-${item.row_id}`}
        />
        <ActionIcon
          icon="trash-outline"
          color="#DC2626"
          bg="#FEF2F2"
          label="Delete"
          onPress={stop(onDelete)}
          testID={`network-delete-${item.row_id}`}
        />
      </View>
    </Pressable>
  );
}

/** A 30px circular icon action button. */
function ActionIcon({
  icon,
  color,
  bg,
  label,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  bg: string;
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  testID: string;
}): React.JSX.Element {
  return (
    <Pressable
      style={[styles.actionIcon, { backgroundColor: bg }]}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Ionicons name={icon} size={15} color={color} />
    </Pressable>
  );
}

/** One incoming connection request, with inline Accept / Reject. */
function PendingRow({
  item,
  busy,
  onAccept,
  onReject,
}: {
  item: PendingConnection;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}): React.JSX.Element {
  const [hover, setHover] = useState(false);
  const name = item.company_name ?? 'A vendor';
  return (
    <Pressable
      style={[styles.row, hover ? styles.rowHover : null]}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
    >
      <View style={[styles.td, styles.colCompany, styles.companyCell]}>
        <VendorAvatar name={name} logoUrl={item.logo_url} size={34} />
        <View style={styles.companyText}>
          <Text style={styles.companyName} numberOfLines={1}>
            {name}
          </Text>
          {item.email ? (
            <Text style={styles.companyEmail} numberOfLines={1}>
              {item.email}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={[styles.td, styles.cellText, styles.colContact]} numberOfLines={1}>
        {item.contact_person || '—'}
      </Text>
      <Text style={[styles.td, styles.cellText, styles.colCountry]} numberOfLines={1}>
        {item.country || '—'}
      </Text>
      <View style={[styles.td, styles.colStatus]}>
        <StatusChip kind="pending" />
      </View>
      <View style={[styles.td, styles.colActions, styles.pendingActions]}>
        <Pressable style={[styles.pendBtn, styles.acceptBtn]} disabled={busy} onPress={onAccept}>
          <Text style={[styles.pendBtnText, { color: colors.green }]}>Accept</Text>
        </Pressable>
        <Pressable style={[styles.pendBtn, styles.rejectBtn]} disabled={busy} onPress={onReject}>
          <Text style={[styles.pendBtnText, { color: colors.red }]}>Reject</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

/** Mobile vendor card: logo + name + status on top, contact + ⋮ menu, country footer. */
function VendorCard({
  item,
  onPress,
  onMenu,
}: {
  item: NetworkVendor;
  onPress: () => void;
  onMenu: () => void;
}): React.JSX.Element {
  const manual = isManualOnly(item);
  return (
    <Pressable style={styles.card} onPress={onPress} testID={`network-card-${item.row_id}`}>
      {/* Top: avatar + company, status chip + kebab */}
      <View style={styles.cardTop}>
        <VendorAvatar name={item.company_name} logoUrl={item.logo_url} email={item.email} size={42} />
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardCompany} numberOfLines={1}>
            {item.company_name}
          </Text>
          {item.contact_person ? (
            <View style={styles.cardContactRow}>
              <Ionicons name="person-outline" size={13} color={colors.textMuted} />
              <Text style={styles.cardContact} numberOfLines={1}>
                {item.contact_person}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.cardTopRight}>
          <StatusChip kind={manual ? 'manual' : 'connected'} />
          <Pressable
            style={styles.kebab}
            onPress={(e: GestureResponderEvent) => {
              e.stopPropagation();
              onMenu();
            }}
            hitSlop={8}
            accessibilityLabel="Actions"
            testID={`network-menu-${item.row_id}`}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Footer: country */}
      <View style={styles.cardFooter}>
        <Ionicons name="location-outline" size={14} color={colors.textMuted} />
        <Text style={styles.cardCountry} numberOfLines={1}>
          {item.country || '—'}
        </Text>
      </View>
    </Pressable>
  );
}

/** Mobile pending-request card with Accept / Reject. */
function PendingCard({
  item,
  busy,
  onAccept,
  onReject,
}: {
  item: PendingConnection;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}): React.JSX.Element {
  const name = item.company_name ?? 'A vendor';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <VendorAvatar name={name} logoUrl={item.logo_url} size={42} />
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardCompany} numberOfLines={1}>
            {name}
          </Text>
          {item.email ? (
            <Text style={styles.cardEmail} numberOfLines={1}>
              {item.email}
            </Text>
          ) : null}
        </View>
        <StatusChip kind="pending" />
      </View>
      <View style={styles.cardPendingActions}>
        <Pressable style={[styles.pendBtn, styles.acceptBtn]} disabled={busy} onPress={onAccept}>
          <Text style={[styles.pendBtnText, { color: colors.green }]}>Accept</Text>
        </Pressable>
        <Pressable style={[styles.pendBtn, styles.rejectBtn]} disabled={busy} onPress={onReject}>
          <Text style={[styles.pendBtnText, { color: colors.red }]}>Reject</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A row in the mobile action sheet. */
function SheetItem({
  icon,
  color,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable style={styles.sheetItem} onPress={onPress}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.sheetItemText}>{label}</Text>
    </Pressable>
  );
}

function StatusChip({ kind }: { kind: 'connected' | 'manual' | 'pending' }): React.JSX.Element {
  const map = {
    connected: { label: 'Connected', bg: colors.greenLight, fg: colors.green },
    manual: { label: 'Manual', bg: colors.accentLight, fg: colors.accent },
    pending: { label: 'Pending', bg: colors.orangeLight, fg: colors.orange },
  }[kind];
  return (
    <View style={[styles.chip, { backgroundColor: map.bg }]}>
      <Text style={[styles.chipText, { color: map.fg }]}>{map.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header buttons — `.btn-p.btn-sm` / `.btn-o.btn-sm`
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  btnPrimaryText: { color: colors.bgWhite, fontSize: 13, fontWeight: '600' },
  btnOutline: {
    backgroundColor: colors.bgWhite,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnOutlineText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },

  // Mobile vendor card
  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    ...shadows.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitleBlock: { flex: 1, minWidth: 0 },
  cardCompany: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardEmail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardContactRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  cardContact: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  kebab: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cardCountry: { fontSize: 13, color: colors.textSecondary },
  cardPendingActions: { flexDirection: 'row', gap: 10, marginTop: 12 },

  // Mobile action sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgWhite,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 8 },
  sheetTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: 12, paddingVertical: 8 },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    ...webOnly({ cursor: 'pointer' }),
  },
  sheetItemText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },

  // `.tabs` / `.ti`
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: { borderBottomColor: colors.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.accent },
  tabCount: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgChip,
    marginLeft: 6,
  },
  tabCountActive: { backgroundColor: colors.accentLight },
  tabCountText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  tabCountTextActive: { color: colors.accent },

  // `.fbar` / `.sw`
  searchBar: { flexDirection: 'row', marginBottom: 16 },
  searchWrap: { flex: 1, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: {
    width: '100%',
    paddingTop: 9,
    paddingBottom: 9,
    paddingLeft: 36,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.bgWhite,
  },

  // `.card` wrapping `.dt`
  tableCard: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },

  // `.dt th` row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgPage,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // `.dt td` row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
  },
  rowHover: { backgroundColor: colors.bgPage },
  td: { paddingVertical: 14, paddingRight: 12 },
  cellText: { fontSize: 13, color: colors.textPrimary },

  // Add / Bulk row, right-aligned at the top of the body (below the bell).
  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginBottom: 16 },

  // Min table width on mobile so the horizontal scroller has something to scroll.

  // Column sizing
  colCompany: { flex: 1, minWidth: 160 },
  colContact: { width: 150 },
  colCountry: { width: 120 },
  colStatus: { width: 120 },
  colActions: { width: 200, paddingRight: 0 },

  // Company cell — `.fca.g8`
  companyCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  companyText: { flex: 1, minWidth: 0 },
  companyName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  companyEmail: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  // `.sc-chip`
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  chipText: { fontSize: 11, fontWeight: '600' },

  // Actions — inline 30px circular icon buttons (gap 6).
  actionsCell: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  actionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },

  // Pending Accept / Reject
  pendingActions: { flexDirection: 'row', gap: 8, width: 160 },
  pendBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.sm },
  pendBtnText: { fontSize: 12, fontWeight: '700' },
  acceptBtn: { backgroundColor: colors.greenLight },
  rejectBtn: { backgroundColor: colors.redLight },

  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: 28, textAlign: 'center' },

  // Delete confirmation modal — centered card.
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 380, backgroundColor: colors.bgWhite, borderRadius: 16, padding: 22, ...shadows.lg },
  confirmTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  confirmBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginBottom: 20 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  confirmBtn: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmCancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgWhite },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  confirmDelete: { backgroundColor: '#DC2626' },
  confirmDeleteText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
