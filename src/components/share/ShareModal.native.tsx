import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
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
import { toast } from '../../stores/toast';
import {
  Avatar,
  Button,
  GlassPanel,
  Icon,
  InfoNote,
  NavBar,
  PickerSheet,
  ScreenBackground,
  SegmentedControl,
  WhatsAppLogo,
  colors,
  glass,
  radii,
  spacing,
} from '../mobile';
import { MystokkLoader } from '../shared/MystokkLoader';

/** Item facts used to compose the WhatsApp/Email share message (mirrors web). */
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
  /** When set, forwards a received share instead of direct-sharing (Phase 5). */
  forward?: ForwardContext;
  card?: ShareCard;
}

type Segment = 'network' | 'outside';
type FacetId = 'industry' | 'country' | 'group' | null;

function rowKey(v: NetworkVendor): string {
  return `${v.source}-${v.row_id}`;
}
function shareable(v: NetworkVendor): boolean {
  return Boolean(v.vendor_id) || Boolean(v.email);
}

const ALL_INDUSTRIES = 'All industries';
const ALL_COUNTRIES = 'All countries';
const ALL_GROUPS = 'All groups';

/** Plain-text mailto body — CRLF joined so iOS Mail/Gmail keep line breaks. */
function buildEmailBody(
  card: ShareCard | undefined,
  link: string,
  city: string | null | undefined,
  country: string | null | undefined,
): string {
  const location = [city, country].filter(Boolean).join(', ');
  const lines: string[] = ['We are pleased to share:', ''];
  if (card?.title) lines.push(card.title);
  lines.push('');
  if (card) lines.push(`Quantity: ${card.quantityAvailable}/${card.quantityTotal} ${card.unit}`);
  if (location) lines.push(`Location: ${location}`);
  lines.push('');
  lines.push('View details:');
  lines.push(link);
  return lines.join('\r\n');
}

/**
 * Share flow — NATIVE (prototype SCREENS.shareWho + shareDone). Single-step
 * "Who sees it?" then a success screen. For an OWN item there is NO terms/price
 * step: the share is created immediately via the SAME logic the web ShareModal
 * uses (shareToNetwork / createPublicLink), so this is a drop-in that Metro
 * swaps for the web modal on native. `forward` is kept for Phase 5.
 */
export function ShareModal({ visible, inventoryId, onClose, onShared, forward, card }: ShareModalProps): React.JSX.Element {
  const queryClient = useQueryClient();

  const [segment, setSegment] = React.useState<Segment>('network');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Record<string, NetworkVendor>>({});
  const [facet, setFacet] = React.useState<{ industry?: string; country?: string; group?: string }>({});
  const [openFacet, setOpenFacet] = React.useState<FacetId>(null);
  const [link, setLink] = React.useState<string | null>(null);

  const networkQuery = useQuery({ queryKey: ['network'], queryFn: getNetwork, enabled: visible, staleTime: 30_000 });
  const network = networkQuery.data ?? [];
  const facetsQuery = useQuery({ queryKey: ['network', 'facets'], queryFn: getNetworkFacets, enabled: visible, staleTime: 60_000 });
  const facets = facetsQuery.data ?? { industries: [], countries: [], groups: [] };
  const meQuery = useQuery({ queryKey: ['myVendor'], queryFn: getMyVendor, enabled: visible, staleTime: 5 * 60_000 });
  const me = meQuery.data;

  const filtered = React.useMemo(() => {
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
    setSegment('network');
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
      const next = { ...prev };
      if (allSelected) for (const v of shareableFiltered) delete next[rowKey(v)];
      else for (const v of shareableFiltered) next[rowKey(v)] = v;
      return next;
    });
  };

  /** Ensure the public/forward link exists (lazily) and return it. */
  const ensureLink = async (): Promise<string | null> => {
    if (link) return link;
    try {
      const { url } = forward ? await createForwardLink(forward) : await createPublicLink(inventoryId);
      setLink(url);
      return url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create share link.');
      return null;
    }
  };

  const shareMutation = useMutation({
    mutationFn: () => (forward ? forwardToNetwork(forward, selectedList) : shareToNetwork(inventoryId, selectedList)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventoryDetail', inventoryId] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onShared?.();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // No success screen — just confirm and close (user request).
      toast.success(`Shared with ${selectedCount} contact${selectedCount === 1 ? '' : 's'}`);
      close();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not share.'),
  });

  const onShareNow = (): void => {
    if (selectedCount === 0) return;
    shareMutation.mutate();
  };

  /** Open the OS share sheet with the public link. */
  const onDeviceShare = async (): Promise<void> => {
    const url = await ensureLink();
    if (!url) return;
    try {
      await Share.share({ message: url });
    } catch {
      // user dismissed the share sheet
    }
  };

  // Outside-network immediate actions (existing link generation).
  const onWhatsApp = async (): Promise<void> => {
    const url = await ensureLink();
    if (url) void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(url)}`);
  };
  const onEmail = async (): Promise<void> => {
    const url = await ensureLink();
    if (!url) return;
    const subject =
      me?.company_name && card?.title ? `${me.company_name} shared "${card.title}" with you` : card?.title ?? 'Shared item on MyStokk';
    void Linking.openURL(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildEmailBody(card, url, me?.city, me?.country))}`);
  };
  const onCopy = async (): Promise<void> => {
    const url = await ensureLink();
    if (!url) return;
    const ok = await copyToClipboard(url);
    if (ok) toast.success('Link copied to clipboard!');
    else await shareText(url);
  };

  const title = card?.title ?? 'item';

  // Closed-control label: the clean word when nothing is filtered (avoids the
  // truncated "All indust…"), or the chosen value once a filter is selected. The
  // ALL_* sentinels still drive the picker options + filtering, unchanged.
  const facetLabel = (id: Exclude<FacetId, null>): string => {
    if (id === 'industry') return facet.industry ?? 'Industry';
    if (id === 'country') return facet.country ?? 'Country';
    return facet.group ?? 'Groups';
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
      <ScreenBackground>
        <NavBar title={`Share "${title}"`} onBack={close} />

        <>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.h1}>Who sees it?</Text>
              <Text style={styles.sub}>They&apos;ll see live stock — never your suppliers</Text>

              <SegmentedControl
                segments={[
                  { key: 'network', label: `My Network · ${network.length}` },
                  { key: 'outside', label: 'Outside network' },
                ]}
                value={segment}
                onChange={(k) => setSegment(k as Segment)}
              />

              {segment === 'network' ? (
                <>
                  <GlassPanel effect="clear" radius={radii.row} fill={glass.fillInput} style={styles.searchPill}>
                    <Icon name="search" size={18} color={colors.muted} />
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search vendors…"
                      placeholderTextColor={colors.placeholder}
                      style={styles.searchInput}
                      autoCorrect={false}
                    />
                  </GlassPanel>

                  {/* Three filter dropdowns in one row. */}
                  <View style={styles.facetRow}>
                    {(['industry', 'country', 'group'] as const).map((id) => (
                      <Pressable key={id} style={styles.facet} onPress={() => setOpenFacet(id)}>
                        <Text style={styles.facetText} numberOfLines={1}>
                          {facetLabel(id)}
                        </Text>
                        <Icon name="down" size={14} color={colors.muted} />
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.selectRow}>
                    <Text style={styles.selectCount}>{selectedCount} selected</Text>
                    <Pressable onPress={toggleAll} disabled={shareableFiltered.length === 0}>
                      <Text style={styles.selectAll}>{allSelected ? 'Clear' : 'Select all'}</Text>
                    </Pressable>
                  </View>

                  {networkQuery.isLoading ? (
                    <View style={styles.loading}>
                      <MystokkLoader size={48} />
                    </View>
                  ) : filtered.length === 0 ? (
                    <Text style={styles.empty}>No vendors match. Add vendors in My Network.</Text>
                  ) : (
                    filtered.map((v) => {
                      const checked = Boolean(selected[rowKey(v)]);
                      const canShare = shareable(v);
                      return (
                        <Pressable
                          key={rowKey(v)}
                          onPress={() => canShare && toggle(v)}
                          disabled={!canShare}
                          style={({ pressed }) => pressed && styles.pressed}
                        >
                          <GlassPanel
                            effect="clear"
                            radius={radii.crow}
                            fill={checked ? 'rgba(232,241,255,0.85)' : undefined}
                            style={[styles.vendorRow, !canShare && styles.vendorDisabled, checked && styles.vendorOn]}
                          >
                            <View style={[styles.cbox, checked && styles.cboxOn]}>
                              {checked ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
                            </View>
                            <Avatar name={v.company_name} size={45} logoUrl={v.logo_url} />
                            <View style={styles.vendorInfo}>
                              <Text style={styles.vendorName} numberOfLines={1}>
                                {v.company_name}
                                {v.is_manual && !v.is_registered ? '  · invite' : ''}
                              </Text>
                              <Text style={styles.vendorMeta} numberOfLines={1}>
                                {[v.contact_person, [v.city, v.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}
                              </Text>
                            </View>
                          </GlassPanel>
                        </Pressable>
                      );
                    })
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.outsideNote}>
                    Share directly with anyone — they&apos;re added to your network when they sign up.
                  </Text>
                  <View style={styles.outsideBtns}>
                    <Button
                      label="WhatsApp"
                      variant="green"
                      icon={<WhatsAppLogo size={20} variant="glyph" />}
                      onPress={() => void onWhatsApp()}
                    />
                    <Button
                      label="Email"
                      variant="ghost"
                      icon={<Icon name="mail" size={19} color={colors.navy} />}
                      onPress={() => void onEmail()}
                    />
                    <Button
                      label="Copy link"
                      variant="ghost"
                      icon={<Icon name="copy" size={19} color={colors.navy} />}
                      onPress={() => void onCopy()}
                    />
                    <Button
                      label="Share via device"
                      variant="ghost"
                      icon={<Icon name="share" size={19} color={colors.navy} />}
                      onPress={() => void onDeviceShare()}
                    />
                  </View>
                  <InfoNote>
                    Shared links show a rich preview card (image, title, company) on WhatsApp and social platforms.
                  </InfoNote>
                </>
              )}
            </ScrollView>

            {/* Sticky CTA — network tab only (outside uses the direct buttons above). */}
            {segment === 'network' ? (
              <View style={styles.cta}>
                <Button
                  label={
                    shareMutation.isPending
                      ? 'Sharing…'
                      : `Share with ${selectedCount} contact${selectedCount === 1 ? '' : 's'}`
                  }
                  variant="primary"
                  onPress={onShareNow}
                  disabled={shareMutation.isPending || selectedCount === 0}
                />
              </View>
            ) : null}
        </>

        <PickerSheet
          open={openFacet === 'industry'}
          onClose={() => setOpenFacet(null)}
          title="Industry"
          options={[ALL_INDUSTRIES, ...facets.industries]}
          value={facet.industry ?? ALL_INDUSTRIES}
          onSelect={(v) => setFacet((f) => ({ ...f, industry: v === ALL_INDUSTRIES ? undefined : v }))}
        />
        <PickerSheet
          open={openFacet === 'country'}
          onClose={() => setOpenFacet(null)}
          title="Country"
          options={[ALL_COUNTRIES, ...facets.countries]}
          value={facet.country ?? ALL_COUNTRIES}
          onSelect={(v) => setFacet((f) => ({ ...f, country: v === ALL_COUNTRIES ? undefined : v }))}
        />
        <PickerSheet
          open={openFacet === 'group'}
          onClose={() => setOpenFacet(null)}
          title="Groups"
          options={[ALL_GROUPS, ...facets.groups]}
          value={facet.group ?? ALL_GROUPS}
          onSelect={(v) => setFacet((f) => ({ ...f, group: v === ALL_GROUPS ? undefined : v }))}
        />
      </ScreenBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter, paddingTop: 112, paddingBottom: 132 },
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.navy },
  sub: { fontSize: 14.5, color: colors.muted, marginTop: 3, marginBottom: 4 },

  searchPill: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 45, paddingHorizontal: 14, marginTop: 4 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },

  facetRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  facet: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 42,
    paddingHorizontal: 11,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fillInput,
  },
  facetText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: colors.navy },

  selectRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 10, paddingHorizontal: 2 },
  selectCount: { fontSize: 13, fontWeight: '800', color: colors.muted },
  selectAll: { fontSize: 13, fontWeight: '800', color: colors.blue },

  loading: { marginTop: 24 },
  empty: { paddingVertical: 24, textAlign: 'center', color: colors.muted, fontSize: 14 },

  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 9 },
  vendorDisabled: { opacity: 0.4 },
  vendorOn: { borderColor: 'rgba(46,124,246,0.6)' },
  cbox: {
    width: 23,
    height: 23,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#C6D1E4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cboxOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  vendorInfo: { flex: 1, minWidth: 0 },
  vendorName: { fontSize: 15, fontWeight: '700', color: colors.navy },
  vendorMeta: { fontSize: 12.5, color: colors.muted, marginTop: 2 },

  outsideNote: { fontSize: 14.5, color: colors.muted, marginTop: 14, marginBottom: 12 },
  outsideBtns: { gap: 10 },

  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12,
    paddingBottom: 32,
  },

  done: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 26 },
  doneIcon: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  doneTitle: { fontSize: 25, fontWeight: '800', color: colors.navy, letterSpacing: -0.5, textAlign: 'center' },
  doneSub: { fontSize: 14.5, color: colors.muted, marginTop: 8, textAlign: 'center', lineHeight: 21 },
  linkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(241,245,252,0.85)',
    borderWidth: 1.5,
    borderColor: '#B7CBEC',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 13,
    marginVertical: 24,
  },
  linkText: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.blueDark },
  doneBtns: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  doneBtn: { flex: 1 },
  doneDone: { alignSelf: 'stretch', marginTop: 11 },
  pressed: { opacity: 0.7 },
});
