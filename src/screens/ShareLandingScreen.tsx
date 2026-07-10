import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import {
  claimShare,
  getPublicShare,
  getPublicShareFiles,
  publicDocUrl,
  publicPhotoUrl,
  resolveShareToken,
  resolveShortCode,
  type PublicShare,
  type PublicShareFile,
} from '../services/supabase/shares';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toast';
import { useLightbox } from '../components/shared/Lightbox';
import { DetailCard, FileRow, HeroCarousel, InfoRow, StatGrid } from '../components/shared/DetailMobile';
import { webOnly } from '../components/layout/web';
import { colors, radius, shadows } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ShareLanding'>;

export function ShareLandingScreen({ navigation, route }: Props): React.JSX.Element {
  const { token: paramToken, code } = route.params;
  const status = useAuthStore((s) => s.status);
  const setPendingShareToken = useAuthStore((s) => s.setPendingShareToken);
  const [claiming, setClaiming] = useState(false);
  // While signed in, resolve ownership before showing anything (self-share protection).
  const [checkingOwner, setCheckingOwner] = useState(status === 'signedIn');

  // The share token: taken from /share/:token directly, or resolved from a
  // /s/:code short link. `undefined` until resolved / when the code is invalid.
  const [token, setToken] = useState<string | undefined>(paramToken);
  const [resolvingCode, setResolvingCode] = useState<boolean>(Boolean(code) && !paramToken);

  useEffect(() => {
    if (paramToken || !code) return;
    let active = true;
    setResolvingCode(true);
    void resolveShortCode(code)
      .then((t) => {
        if (active) {
          setToken(t ?? undefined);
          setResolvingCode(false);
        }
      })
      .catch(() => {
        if (active) setResolvingCode(false);
      });
    return () => {
      active = false;
    };
  }, [code, paramToken]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['publicShare', token],
    queryFn: () => getPublicShare(token as string),
    enabled: Boolean(token),
    staleTime: 60_000,
  });

  const filesQuery = useQuery({
    queryKey: ['publicShareFiles', token],
    queryFn: () => getPublicShareFiles(token as string),
    enabled: Boolean(token),
    staleTime: 60_000,
  });

  const goToOwnListing = (inventoryId: string): void => {
    toast('This is your own listing.');
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    navigation.navigate('InventoryDetail', { inventoryId });
  };

  // Owner self-share protection (Spec §7.6): on open, if the signed-in vendor
  // owns this listing, route to their Inventory Detail with a toast instead of
  // Received Detail. Also triggers the bogus self-share cleanup server-side.
  useEffect(() => {
    if (status !== 'signedIn' || !token) {
      setCheckingOwner(false);
      return;
    }
    let active = true;
    setCheckingOwner(true);
    void (async () => {
      try {
        const res = await resolveShareToken(token);
        if (!active) return;
        if (res.found && res.is_owner && res.inventory_id) {
          goToOwnListing(res.inventory_id);
          return; // leave the screen; keep the spinner during the transition
        }
      } catch {
        // fall through to the normal preview on any resolve error
      }
      if (active) setCheckingOwner(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token]);

  const onAuth = (target: 'Login' | 'Signup'): void => {
    if (!token) return;
    setPendingShareToken(token); // claimed once signed in (see RootNavigator)
    navigation.navigate(target);
  };

  const onClaim = async (): Promise<void> => {
    if (!token) return;
    setClaiming(true);
    try {
      const res = await claimShare(token);
      if (res.is_owner) {
        goToOwnListing(res.inventory_id);
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        navigation.navigate('ReceivedDetail', { shareId: res.share_id });
      }
    } catch {
      setClaiming(false);
    }
  };

  const authed = status === 'signedIn';

  return (
    <View style={styles.fill}>
      {/* Top header bar — logo only (no Login / Sign Up buttons by request). */}
      <View style={styles.topbar}>
        <View style={styles.logo}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>📦</Text>
          </View>
          <Text style={styles.logoText}>MyStokk</Text>
        </View>
      </View>

      {resolvingCode || isLoading || checkingOwner ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : isError || !token || !data ? (
        <View style={styles.center}>
          <Text style={styles.errTitle}>Link unavailable</Text>
          <Text style={styles.errSub}>This share link is invalid or no longer active.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Landing')}>
            <Text style={styles.primaryBtnText}>Go to MyStokk</Text>
          </Pressable>
        </View>
      ) : (
        <Preview
          share={data}
          files={filesQuery.data ?? []}
          authed={authed}
          claiming={claiming}
          onClaim={() => void onClaim()}
          onLogin={() => onAuth('Login')}
          onSignup={() => onAuth('Signup')}
        />
      )}
    </View>
  );
}

/**
 * Login-free item preview. Mirrors the signed-in Received Item detail layout,
 * minus everything a stranger shouldn't see or can't do: no SKU / category / age
 * subtitle, no stock location, no price, no "shared with" count, no
 * Reserve/Share/Edit actions, and the sharer's company name without their contact
 * details. The reserve path is the sign-up CTA.
 */
function Preview({
  share,
  files,
  authed,
  claiming,
  onClaim,
  onLogin,
  onSignup,
}: {
  share: PublicShare;
  files: PublicShareFile[];
  authed: boolean;
  claiming: boolean;
  onClaim: () => void;
  onLogin: () => void;
  onSignup: () => void;
}): React.JSX.Element {
  const { open: openLightbox } = useLightbox();
  // Photos live in a public-read bucket, so they load without auth. Drop any
  // path that fails to resolve rather than rendering a broken frame.
  const photos = share.photo_paths.map((p) => publicPhotoUrl(p)).filter((u): u is string => Boolean(u));
  const initial = (share.shared_by_company ?? 'V').trim().charAt(0).toUpperCase();

  const openDoc = async (storagePath: string): Promise<void> => {
    // The signed URL is fetched async, so on web claim the popup synchronously —
    // otherwise the browser blocks the tab opened after the await.
    const tab = Platform.OS === 'web' && typeof window !== 'undefined' ? window.open('', '_blank') : null;
    try {
      const url = await publicDocUrl(share.token, storagePath);
      if (tab) tab.location.href = url;
      else await Linking.openURL(url);
    } catch {
      tab?.close();
      toast.error('Could not open this file.');
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <View style={styles.column}>
        <Text style={styles.stockBadge}>Stock Update</Text>

        {photos.length > 0 ? (
          <HeroCarousel photos={photos} onOpen={(i) => openLightbox(photos, i)} />
        ) : (
          <View style={styles.noPhoto}>
            <Ionicons name="cube-outline" size={56} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.title}>{share.title}</Text>
          <View style={styles.divider} />
          <InfoRow label="Origin" value={share.origin || '—'} />
          <StatGrid
            stats={[
              { label: 'Total Qty', value: share.quantity, sub: share.unit },
              { label: 'Available', value: share.quantity_available, sub: share.unit, color: colors.green },
            ]}
          />
        </View>

        {share.forward_remark ? (
          <View style={styles.remark}>
            <Text style={styles.remarkText}>{share.forward_remark}</Text>
          </View>
        ) : null}

        {share.description ? (
          <DetailCard icon="reader-outline" title="Details">
            <Text style={styles.detailsText}>{share.description}</Text>
          </DetailCard>
        ) : null}

        {files.length > 0 ? (
          <DetailCard icon="document-outline" title="Packing list and spec sheets">
            {files.map((f) => (
              <FileRow key={f.storage_path} name={f.name} onPress={() => void openDoc(f.storage_path)} />
            ))}
          </DetailCard>
        ) : null}

        <DetailCard icon="person-outline" title="Shared by">
          <View style={styles.sharedRow}>
            <View style={styles.sharedAvatar}>
              <Text style={styles.sharedAvatarText}>{initial}</Text>
            </View>
            <Text style={styles.sharedName} numberOfLines={1}>
              {share.shared_by_company ?? 'A MyStokk vendor'}
            </Text>
          </View>
        </DetailCard>

        {/* CTA / auth gate */}
        <View style={styles.card}>
          <Text style={styles.interested}>Interested in this inventory?</Text>
          {authed ? (
            <Pressable style={styles.primaryBtn} onPress={onClaim} disabled={claiming} testID="public-claim">
              {claiming ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>📦 View full details & reserve</Text>
              )}
            </Pressable>
          ) : (
            <>
              <Pressable style={styles.primaryBtn} onPress={onSignup} testID="public-create-account">
                <Text style={styles.primaryBtnText}>Create Account to Reserve</Text>
              </Pressable>
              <Pressable style={styles.outlineBtn} onPress={onLogin} testID="public-log-in">
                <Text style={styles.outlineBtnText}>Log In</Text>
              </Pressable>
            </>
          )}

          <View style={styles.trustRow}>
            <Text style={styles.trustItem}>🛡 Secure Platform</Text>
            <Text style={styles.trustItem}>🏢 B2B Trading</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bgPage },

  // Top header bar
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgWhite,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: { fontSize: 14 },
  logoText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },

  // Loading / error
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  errTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 },
  errSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 18 },

  // Page content — same centred column width as the signed-in detail pages.
  scroll: { flex: 1 },
  body: { paddingVertical: 32, paddingHorizontal: 16, alignItems: 'center' },
  column: { width: '100%', maxWidth: 760 },

  stockBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  noPhoto: {
    height: 240,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgChip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },

  remark: {
    backgroundColor: colors.yellowLight,
    borderWidth: 1,
    borderColor: colors.yellowBorder,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 14,
  },
  remarkText: { fontSize: 13, color: colors.amber },

  detailsText: { fontSize: 13, color: colors.textSecondary, lineHeight: 22 },

  sharedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sharedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedAvatarText: { fontSize: 16, fontWeight: '800', color: colors.accent },
  sharedName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  interested: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', marginBottom: 14 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadows.sm,
    ...webOnly({ cursor: 'pointer' }),
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  outlineBtn: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 10,
    ...webOnly({ cursor: 'pointer' }),
  },
  outlineBtnText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },

  trustRow: { flexDirection: 'row', gap: 24, justifyContent: 'center', marginTop: 20 },
  trustItem: { fontSize: 12, color: colors.textMuted },
});
