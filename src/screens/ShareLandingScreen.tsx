import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { claimShare, getPublicShare, publicPhotoUrl, resolveShareToken, type PublicShare } from '../services/supabase/shares';
import { toFullUrl } from '../services/supabase/storage';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toast';
import { useLightbox } from '../components/shared/Lightbox';
import { webOnly } from '../components/layout/web';
import { colors, radius, shadows } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ShareLanding'>;

export function ShareLandingScreen({ navigation, route }: Props): React.JSX.Element {
  const { token } = route.params;
  const status = useAuthStore((s) => s.status);
  const setPendingShareToken = useAuthStore((s) => s.setPendingShareToken);
  const [claiming, setClaiming] = useState(false);
  // While signed in, resolve ownership before showing anything (self-share protection).
  const [checkingOwner, setCheckingOwner] = useState(status === 'signedIn');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['publicShare', token],
    queryFn: () => getPublicShare(token),
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
    if (status !== 'signedIn') {
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
    setPendingShareToken(token); // claimed once signed in (see RootNavigator)
    navigation.navigate(target);
  };

  const onClaim = async (): Promise<void> => {
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

      {isLoading || checkingOwner ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : isError || !data ? (
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

function Preview({
  share,
  authed,
  claiming,
  onClaim,
  onLogin,
  onSignup,
}: {
  share: PublicShare;
  authed: boolean;
  claiming: boolean;
  onClaim: () => void;
  onLogin: () => void;
  onSignup: () => void;
}): React.JSX.Element {
  const qty = share.quantity.toLocaleString();
  const photoUrl = publicPhotoUrl(share.first_photo_path);
  const fullPhoto = toFullUrl(photoUrl);
  const { open: openLightbox } = useLightbox();
  // Fall back to the cube placeholder if the photo URL fails to load.
  const [imgError, setImgError] = useState(false);
  const showPhoto = Boolean(fullPhoto) && !imgError;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <View style={styles.column}>
        {/* Stock Update badge */}
        <Text style={styles.stockBadge}>Stock Update</Text>

        {/* Product image — the inventory-photos bucket is public-read, so the
            first photo loads here without auth (cube placeholder when none or on
            load error). Tapping it opens the shared lightbox. */}
        <View style={styles.imageBox}>
          {showPhoto ? (
            <Pressable
              onPress={() => openLightbox([fullPhoto], 0)}
              style={[styles.imagePress, webOnly({ cursor: 'pointer' })]}
              accessibilityLabel="View photo"
            >
              <Image
                source={{ uri: fullPhoto }}
                style={styles.imageImg}
                resizeMode="cover"
                onError={() => setImgError(true)}
              />
            </Pressable>
          ) : (
            <Ionicons name="cube-outline" size={56} color={colors.textMuted} />
          )}
        </View>

        {/* Product info card */}
        <View style={styles.card}>
          <Text style={styles.title}>{share.title}</Text>

          <View style={styles.sharedByRow}>
            <Text style={styles.sharedByIcon}>🏢</Text>
            <Text style={styles.sharedByText}>
              Shared by <Text style={styles.sharedByName}>{share.shared_by_company ?? 'a MyStokk vendor'}</Text>
            </Text>
          </View>

          {/* Stat grid — price intentionally omitted from the public landing. */}
          <View style={styles.statGrid}>
            <Stat label="Quantity" value={qty} sub={share.unit} />
            <Stat label="Available" value={qty} sub={share.unit} valueColor={colors.green} />
            <Stat label="Origin" value={share.origin ?? '📍'} sub={share.origin ? ' ' : '—'} last />
          </View>

          {share.stock_location ? (
            <View style={styles.locationLine}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.locationText}>
                <Text style={styles.metaLabel}>Stock Location: </Text>
                {share.stock_location}
              </Text>
            </View>
          ) : null}

          {share.category ? (
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Category: </Text>
              {share.category}
            </Text>
          ) : null}

          {share.forward_remark ? (
            <View style={styles.remark}>
              <Text style={styles.remarkText}>{share.forward_remark}</Text>
            </View>
          ) : null}

          {share.description ? <Text style={styles.description}>{share.description}</Text> : null}

          {/* CTA / auth gate */}
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

          {/* Trust badges */}
          <View style={styles.trustRow}>
            <Text style={styles.trustItem}>🛡 Secure Platform</Text>
            <Text style={styles.trustItem}>🏢 B2B Trading</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  sub,
  valueColor,
  small,
  last,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
  small?: boolean;
  last?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.statCell, last ? null : styles.statCellBorder]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, small ? styles.statValueSmall : null, valueColor ? { color: valueColor } : null]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.statSub} numberOfLines={1}>
        {sub}
      </Text>
    </View>
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
  topbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghostBtn: { paddingVertical: 7, paddingHorizontal: 10, ...webOnly({ cursor: 'pointer' }) },
  ghostBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  signupBtn: {
    backgroundColor: colors.primary, // #0F172A
    borderRadius: radius.md,
    paddingVertical: 7,
    paddingHorizontal: 16,
    ...webOnly({ cursor: 'pointer' }),
  },
  signupBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  // Loading / error
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  errTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 },
  errSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 18 },

  // Page content (max-width 640, centered)
  scroll: { flex: 1 },
  body: { paddingVertical: 32, paddingHorizontal: 16, alignItems: 'center' },
  column: { width: '100%', maxWidth: 640 },

  stockBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  imageBox: {
    height: 300,
    maxHeight: 340,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgChip, // light placeholder (#F1F5F9) when no photo
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  imagePress: { width: '100%', height: '100%' },
  imageImg: { width: '100%', height: '100%' },

  // `.card`
  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },

  sharedByRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  sharedByIcon: { fontSize: 15 },
  sharedByText: { fontSize: 14, color: colors.textPrimary },
  sharedByName: { fontWeight: '700' },

  // Stat grid
  statGrid: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: 16,
  },
  statCell: { flex: 1, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center' },
  statCellBorder: { borderRightWidth: 1, borderRightColor: colors.border },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statValueSmall: { fontSize: 16 },
  statSub: { fontSize: 11, color: colors.textSecondary },

  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  locationText: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  metaLine: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  metaLabel: { fontWeight: '700' },

  remark: {
    backgroundColor: colors.yellowLight,
    borderWidth: 1,
    borderColor: colors.yellowBorder,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  remarkText: { fontSize: 13, color: colors.amber },
  description: { fontSize: 13, color: colors.textSecondary, lineHeight: 21, marginBottom: 16 },

  interested: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', marginBottom: 14 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadows.sm,
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
  },
  outlineBtnText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },

  // Trust badges
  trustRow: { flexDirection: 'row', gap: 24, justifyContent: 'center', marginTop: 20 },
  trustItem: { fontSize: 12, color: colors.textMuted },
});
