import React, { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BrandLoader } from '../shared/BrandLoader';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getNetwork, getNetworkFacets, type NetworkVendor } from '../../services/supabase/network';
import { getMyVendor } from '../../services/supabase/vendor';
import {
  createForwardLink,
  createPublicLink,
  forwardToNetwork,
  shareToNetwork,
  type ForwardContext,
} from '../../services/supabase/shares';
import { copyToClipboard, shareText } from '../../utils/clipboard';
import { webOnly } from '../layout/web';
import { VendorAvatar } from '../shared/VendorAvatar';
import { colors, radius, shadows } from '../../theme/tokens';
import { toast } from '../../stores/toast';

/** Item facts used to compose the WhatsApp/Email share message. */
export interface ShareCard {
  title: string;
  quantityAvailable: number;
  quantityTotal: number;
  unit: string;
}

interface ShareModalProps {
  visible: boolean;
  inventoryId: string;
  onClose: () => void;
  onShared?: () => void;
  /** When set, the modal forwards a received share instead of direct-sharing. */
  forward?: ForwardContext;
  /** Item facts for the WhatsApp/Email message body (B5). */
  card?: ShareCard;
}

type Tab = 'network' | 'new';

function rowKey(v: NetworkVendor): string {
  return `${v.source}-${v.row_id}`;
}
function shareable(v: NetworkVendor): boolean {
  return Boolean(v.vendor_id) || Boolean(v.email);
}

/**
 * Prefilled body for the seller's mail client (opened via mailto:). Plain text
 * only — mailto bodies can't carry HTML (no bold / buttons / hidden links), so
 * the short URL is shown under a "View details:" label (mail apps auto-link it).
 *
 * Lines are joined with CRLF: several mail clients (iOS Mail / Gmail) collapse a
 * bare "\n" from a mailto body into spaces, running everything into one blob;
 * "\r\n" is honored as a real line break.
 */
function buildEmailBody(
  card: ShareCard | undefined,
  link: string,
  city: string | null | undefined,
  country: string | null | undefined,
): string {
  const location = [city, country].filter(Boolean).join(', ');

  const lines: string[] = ['We are pleased to share:', ''];
  if (card?.title) lines.push(card.title); // title on its own line
  lines.push('');
  if (card) lines.push(`Quantity: ${card.quantityAvailable}/${card.quantityTotal} ${card.unit}`);
  if (location) lines.push(`Location: ${location}`);
  lines.push('');
  lines.push('View details:');
  lines.push(link);

  return lines.join('\r\n');
}

export function ShareModal({ visible, inventoryId, onClose, onShared, forward, card }: ShareModalProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('network');

  // My Network tab state
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, NetworkVendor>>({});
  const [facet, setFacet] = useState<{ industry?: string; country?: string; group?: string }>({});

  // New Contact tab state — a public/forward link, lazily created on first visit.
  const [link, setLink] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  const networkQuery = useQuery({ queryKey: ['network'], queryFn: getNetwork, enabled: visible, staleTime: 30_000 });
  const network = networkQuery.data ?? [];

  // Distinct Industry / Country / Group values for the filter dropdowns.
  const facetsQuery = useQuery({ queryKey: ['network', 'facets'], queryFn: getNetworkFacets, enabled: visible, staleTime: 60_000 });
  const facets = facetsQuery.data ?? { industries: [], countries: [], groups: [] };

  // The sender's own identity for the WhatsApp/Email message (B5).
  const meQuery = useQuery({ queryKey: ['myVendor'], queryFn: getMyVendor, enabled: visible, staleTime: 5 * 60_000 });
  const me = meQuery.data;

  const filtered = useMemo(() => {
    let rows = network;
    if (facet.industry) rows = rows.filter((v) => v.industry === facet.industry);
    if (facet.country) rows = rows.filter((v) => v.country === facet.country);
    if (facet.group) rows = rows.filter((v) => v.group_name === facet.group);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((v) => [v.company_name, v.contact_person, v.city, v.email].some((f) => f?.toLowerCase().includes(q)));
    return rows;
  }, [network, facet, search]);

  const shareableFiltered = filtered.filter(shareable);
  const selectedList = Object.values(selected);
  const selectedCount = selectedList.length;
  const allSelected = shareableFiltered.length > 0 && shareableFiltered.every((v) => selected[rowKey(v)]);

  const reset = (): void => {
    setTab('network');
    setSearch('');
    setSelected({});
    setFacet({});
    setLink(null);
  };
  const close = (): void => {
    reset();
    onClose();
  };

  const toggle = (v: NetworkVendor): void => {
    setSelected((prev) => {
      const key = rowKey(v);
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = v;
      return next;
    });
  };

  const toggleAll = (): void => {
    setSelected((prev) => {
      if (allSelected) {
        const next = { ...prev };
        for (const v of shareableFiltered) delete next[rowKey(v)];
        return next;
      }
      const next = { ...prev };
      for (const v of shareableFiltered) next[rowKey(v)] = v;
      return next;
    });
  };

  const networkMutation = useMutation({
    mutationFn: () => (forward ? forwardToNetwork(forward, selectedList) : shareToNetwork(inventoryId, selectedList)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventoryDetail', inventoryId] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onShared?.();
      toast.success('Shared successfully!');
      close();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not share.'),
  });

  // Create the public/forward link the first time the New Contact tab opens.
  const openNewContact = async (): Promise<void> => {
    setTab('new');
    if (link || linkLoading) return;
    setLinkLoading(true);
    try {
      const { url } = forward ? await createForwardLink(forward) : await createPublicLink(inventoryId);
      setLink(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create share link.');
    } finally {
      setLinkLoading(false);
    }
  };

  const onWhatsApp = (): void => {
    if (!link) return;
    void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(link)}`);
  };
  const onEmail = (): void => {
    if (!link) return;
    const subject =
      me?.company_name && card?.title
        ? `${me.company_name} shared "${card.title}" with you`
        : card?.title ?? 'Shared item on MyStokk';
    const body = buildEmailBody(card, link, me?.city, me?.country);
    void Linking.openURL(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };
  const onCopy = async (): Promise<void> => {
    if (!link) return;
    const ok = await copyToClipboard(link);
    if (ok) toast.success('Link copied to clipboard!');
    else await shareText(link);
  };

  const title = card?.title ?? 'item';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        {/* The mirror uses a wider card for My Network (560) than New Contact (480). */}
        <Pressable style={[styles.card, { maxWidth: tab === 'network' ? 560 : 480 }]} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              ⤴ Share "{title}"
            </Text>
            <Pressable style={styles.close} onPress={close} hitSlop={8} testID="share-close">
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {/* Segmented control */}
            <View style={styles.stabs}>
              <Pressable
                style={[styles.stab, tab === 'network' ? styles.stabActive : null]}
                onPress={() => setTab('network')}
                testID="share-tab-network"
              >
                <Text style={[styles.stabText, tab === 'network' ? styles.stabTextActive : null]}>
                  👥 My Network ({network.length})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.stab, tab === 'new' ? styles.stabActive : null]}
                onPress={() => void openNewContact()}
                testID="share-tab-new"
              >
                <Text style={[styles.stabText, tab === 'new' ? styles.stabTextActive : null]}>👤+ New Contact</Text>
              </Pressable>
            </View>

            {tab === 'network' ? (
              <NetworkTab
                loading={networkQuery.isLoading}
                search={search}
                onSearch={setSearch}
                vendors={filtered}
                selected={selected}
                onToggle={toggle}
                selectAllCount={shareableFiltered.length}
                allSelected={allSelected}
                onToggleAll={toggleAll}
                selectedCount={selectedCount}
                total={network.length}
                industries={facets.industries}
                countries={facets.countries}
                groups={facets.groups}
                facet={facet}
                onFacet={setFacet}
              />
            ) : (
              <NewContactTab
                loading={linkLoading}
                ready={Boolean(link)}
                onWhatsApp={onWhatsApp}
                onEmail={onEmail}
                onCopy={() => void onCopy()}
              />
            )}
          </ScrollView>

          {/* Footer (My Network tab only — the mirror's New Contact tab has no footer) */}
          {tab === 'network' ? (
            <View style={styles.footer}>
              <Pressable style={styles.btnOutline} onPress={close} testID="share-cancel">
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, selectedCount === 0 || networkMutation.isPending ? styles.btnDisabled : null]}
                disabled={selectedCount === 0 || networkMutation.isPending}
                onPress={() => networkMutation.mutate()}
                testID="share-network-submit"
              >
                <Text style={styles.btnPrimaryText}>Share{selectedCount > 0 ? ` (${selectedCount})` : ''}</Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NetworkTab({
  loading,
  search,
  onSearch,
  vendors,
  selected,
  onToggle,
  selectAllCount,
  allSelected,
  onToggleAll,
  selectedCount,
  total,
  industries,
  countries,
  groups,
  facet,
  onFacet,
}: {
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  vendors: NetworkVendor[];
  selected: Record<string, NetworkVendor>;
  onToggle: (v: NetworkVendor) => void;
  selectAllCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  selectedCount: number;
  total: number;
  industries: string[];
  countries: string[];
  groups: string[];
  facet: { industry?: string; country?: string; group?: string };
  onFacet: (f: { industry?: string; country?: string; group?: string }) => void;
}): React.JSX.Element {
  return (
    <View>
      {/* Filter row: search + Industries + Countries */}
      <View style={styles.filterRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={14} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vendors..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={onSearch}
            autoCorrect={false}
            testID="share-network-search"
          />
        </View>
        <FacetSelect
          label="All Industries"
          value={facet.industry}
          options={industries}
          onChange={(v) => onFacet({ ...facet, industry: v })}
        />
        <FacetSelect
          label="All Countries"
          value={facet.country}
          options={countries}
          onChange={(v) => onFacet({ ...facet, country: v })}
        />
      </View>

      {/* Groups row */}
      <View style={styles.groupsRow}>
        <FacetSelect
          label="All Groups"
          value={facet.group}
          options={groups}
          onChange={(v) => onFacet({ ...facet, group: v })}
          width={180}
        />
      </View>

      <View style={styles.selectRow}>
        <Text style={styles.selectCount}>
          {selectedCount} selected of {total} vendor{total === 1 ? '' : 's'}
        </Text>
        <Pressable onPress={onToggleAll} disabled={selectAllCount === 0} testID="share-select-all">
          <Text style={styles.selectAll}>{allSelected ? 'Clear' : `Select All (${selectAllCount})`}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <BrandLoader mode="loop" size={90} />
        </View>
      ) : (
        <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator>
          {vendors.length === 0 ? (
            <Text style={styles.empty} testID="share-network-empty">
              No vendors match. Add vendors in My Network.
            </Text>
          ) : (
            vendors.map((v) => {
              const checked = Boolean(selected[rowKey(v)]);
              const canShare = shareable(v);
              return (
                <Pressable
                  key={rowKey(v)}
                  style={[styles.vendorRow, !canShare ? styles.vendorDisabled : null]}
                  disabled={!canShare}
                  onPress={() => onToggle(v)}
                  testID={`share-vendor-${rowKey(v)}`}
                >
                  <View style={[styles.checkbox, checked ? styles.checkboxOn : null]}>
                    {checked ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <VendorAvatar name={v.company_name} logoUrl={v.logo_url} size={34} />
                  <View style={styles.vendorInfo}>
                    <Text style={styles.vendorName} numberOfLines={1}>
                      {v.company_name}
                      {v.is_manual && !v.is_registered ? '  · invite' : ''}
                    </Text>
                    <Text style={styles.vendorMeta} numberOfLines={1}>
                      {[v.email, [v.city, v.country].filter(Boolean).join(', ')].filter(Boolean).join(' • ') || '—'}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      <View style={styles.sharingWith}>
        <Text style={styles.sharingWithText}>
          Sharing with: {selectedCount} contact{selectedCount === 1 ? '' : 's'} from your network
        </Text>
      </View>
    </View>
  );
}

/** Filter dropdown (`.fsel`) — value or the "All …" label, opening a nested option list. */
function FacetSelect({
  label,
  value,
  options,
  onChange,
  width,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (v: string | undefined) => void;
  width?: number;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable style={[styles.fsel, width ? { width } : null]} onPress={() => setOpen(true)}>
        <Text style={value ? styles.fselValue : styles.fselLabel} numberOfLines={1}>
          {value ?? label}
        </Text>
        <Text style={styles.fselChevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.optionOverlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.optionCard} onPress={(e) => e.stopPropagation()}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Pressable
                style={styles.option}
                onPress={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, !value ? styles.optionSelected : null]}>{label}</Text>
              </Pressable>
              {options.map((o) => (
                <Pressable
                  key={o}
                  style={styles.option}
                  onPress={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, o === value ? styles.optionSelected : null]}>{o}</Text>
                </Pressable>
              ))}
              {options.length === 0 ? <Text style={styles.optionEmpty}>Nothing to filter by yet.</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function NewContactTab({
  loading,
  ready,
  onWhatsApp,
  onEmail,
  onCopy,
}: {
  loading: boolean;
  ready: boolean;
  onWhatsApp: () => void;
  onEmail: () => void;
  onCopy: () => void;
}): React.JSX.Element {
  const disabled = !ready;
  return (
    <View>
      <Text style={styles.subtitle}>Share directly with anyone outside your network.</Text>

      {loading ? (
        <View style={styles.center}>
          <BrandLoader mode="loop" size={90} />
        </View>
      ) : null}

      <Pressable
        style={[styles.smb, styles.smbWa, disabled ? styles.btnDisabled : null]}
        onPress={onWhatsApp}
        disabled={disabled}
        testID="share-new-whatsapp"
      >
        <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
        <Text style={styles.smbWaText}>WhatsApp</Text>
      </Pressable>

      <Pressable
        style={[styles.smb, disabled ? styles.btnDisabled : null]}
        onPress={onEmail}
        disabled={disabled}
        testID="share-new-email"
      >
        <Ionicons name="mail-outline" size={18} color={colors.textPrimary} />
        <Text style={styles.smbText}>Email</Text>
      </Pressable>

      <Pressable
        style={[styles.smb, disabled ? styles.btnDisabled : null]}
        onPress={onCopy}
        disabled={disabled}
        testID="share-new-copy"
      >
        <Ionicons name="link-outline" size={18} color={colors.textPrimary} />
        <Text style={styles.smbText}>Copy Link</Text>
      </Pressable>

      <Text style={styles.infoNote}>
        Shared links include a rich card preview (image, title, company) on WhatsApp and social platforms. When
        someone views and signs up, they're automatically added to your network.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // `.mo`
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // `.md`
  card: {
    backgroundColor: colors.bgWhite,
    borderRadius: radius.xl,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    overflow: 'hidden',
    ...shadows.lg,
    ...webOnly({ maxHeight: '90vh' }),
  },

  // `.mh`
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgChip,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  closeText: { fontSize: 16, color: colors.textSecondary },

  // `.mb`
  body: { flexShrink: 1 },
  bodyContent: { paddingHorizontal: 24, paddingVertical: 20 },

  // `.stabs` / `.stab`
  stabs: { flexDirection: 'row', backgroundColor: colors.bgChip, borderRadius: radius.md, padding: 3, marginBottom: 16 },
  stab: { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  stabActive: { backgroundColor: colors.bgWhite, ...shadows.sm },
  stabText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  stabTextActive: { color: colors.textPrimary },

  // New Contact tab
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  preparing: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  // `.smb`
  smb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgWhite,
    marginBottom: 10,
  },
  smbText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  // `.smb.wa`
  smbWa: { backgroundColor: '#25D366', borderColor: '#25D366' },
  smbWaText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  infoNote: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    backgroundColor: colors.bgPage,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 12,
  },

  // My Network tab
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  groupsRow: { marginBottom: 10 },
  searchWrap: { flex: 1, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },

  // `.fsel`
  fsel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgWhite,
  },
  fselLabel: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  fselValue: { fontSize: 13, color: colors.textPrimary, flexShrink: 1 },
  fselChevron: { fontSize: 11, color: colors.textMuted },

  optionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  optionCard: {
    backgroundColor: colors.bgWhite,
    borderRadius: radius.lg,
    width: '100%',
    maxWidth: 320,
    maxHeight: '70%',
    ...shadows.lg,
  },
  option: { paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { fontSize: 14, color: colors.textSecondary },
  optionSelected: { color: colors.accent, fontWeight: '700' },
  optionEmpty: { paddingHorizontal: 18, paddingVertical: 16, fontSize: 13, color: colors.textMuted },
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
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  selectCount: { fontSize: 12, color: colors.textMuted },
  selectAll: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  list: { maxHeight: 240 },
  center: { paddingVertical: 28, alignItems: 'center' },
  empty: { paddingVertical: 24, textAlign: 'center', color: colors.textMuted, fontSize: 13 },

  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  vendorDisabled: { opacity: 0.4 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  vendorInfo: { flex: 1, minWidth: 0 },
  vendorName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  vendorMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  sharingWith: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 12 },
  sharingWithText: { fontSize: 12, color: colors.textMuted },

  // `.mf`
  footer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnOutline: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: 'transparent',
  },
  btnOutlineText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  btnPrimary: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
});
