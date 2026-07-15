import React from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { toast } from '../stores/toast';
import { getReceivedShareDetail, type ReceivedShareDetail } from '../services/supabase/received';
import { createReservation } from '../services/supabase/reservations';
import type { ForwardContext } from '../services/supabase/shares';
import { ShareModal } from '../components/share/ShareModal';
import { PreShareModal } from '../components/share/PreShareModal';
import { ReserveSheet } from '../components/reservations/ReserveSheet';
import {
  Avatar,
  Button,
  Card,
  DocRow,
  Icon,
  KeyValue,
  NavBar,
  PhotoCarousel,
  ScreenBackground,
  StatsStrip,
  WhatsAppLogo,
  colors,
  layout,
  spacing,
} from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceivedDetail'>;

/** Digits-only phone for a wa.me link. */
function waNumber(phone: string | null): string {
  return (phone ?? '').replace(/[^\d]/g, '');
}

function priceText(d: ReceivedShareDetail): string {
  if (d.display_price === null) return 'Price on request';
  return `${d.display_currency ?? ''} ${d.display_price.toLocaleString()} / ${d.unit}`.trim();
}

/** Received detail (prototype SCREENS.receivedDetail). Bound to existing data + createReservation. */
export function ReceivedDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { shareId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [reserveOpen, setReserveOpen] = React.useState(false);
  const [preShareOpen, setPreShareOpen] = React.useState(false);
  const [forwardOpen, setForwardOpen] = React.useState(false);
  const [forwardCtx, setForwardCtx] = React.useState<ForwardContext | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['receivedDetail', shareId],
    queryFn: () => getReceivedShareDetail(shareId),
    staleTime: 30_000,
  });

  const reserveMutation = useMutation({
    mutationFn: (vars: { inventoryId: string; qty: number; price: number | null; message: string | null }) =>
      createReservation(vars.inventoryId, shareId, vars.qty, vars.price, vars.message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['receivedDetail', shareId] });
      setReserveOpen(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Reservation request sent!');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not reserve.'),
  });

  // Share preserves the privacy-chain terms step: PreShareModal (set your own
  // price + remark) → ShareModal in forward mode. Item 4 replaces this UI with a
  // native terms-first flow; the backend forward call is unchanged.
  const continueForward = (price: number | null, remark: string | null): void => {
    setForwardCtx({ parentShareId: shareId, price, currency: data?.display_currency ?? 'AED', remark });
    setPreShareOpen(false);
    setForwardOpen(true);
  };

  return (
    <ScreenBackground>
      {/* Back button only — no title, no share on the carousel (item 2). */}
      <NavBar onBack={() => navigation.goBack()} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Failed to load.'}</Text>
          <Button label="Retry" variant="ghost" size="sm" onPress={() => void refetch()} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Detail
            data={data}
            onReserve={() => setReserveOpen(true)}
            onShare={() => setPreShareOpen(true)}
            onEdit={() => navigation.navigate('ReceivedEdit', { shareId })}
          />
        </ScrollView>
      )}

      {data ? (
        <>
          <ReserveSheet
            visible={reserveOpen}
            available={data.available_to_me}
            unit={data.unit}
            currency={data.display_currency ?? 'AED'}
            price={data.display_price}
            submitting={reserveMutation.isPending}
            onClose={() => setReserveOpen(false)}
            onSubmit={(qty, price, message) =>
              reserveMutation.mutate({ inventoryId: data.inventory_id, qty, price, message })
            }
          />

          <PreShareModal
            visible={preShareOpen}
            currency={data.display_currency ?? 'AED'}
            unit={data.unit}
            onClose={() => setPreShareOpen(false)}
            onContinue={continueForward}
          />

          {forwardCtx ? (
            <ShareModal
              visible={forwardOpen}
              inventoryId={data.inventory_id}
              forward={forwardCtx}
              card={{
                title: data.title,
                quantityAvailable: data.available_to_me,
                quantityTotal: data.quantity,
                unit: data.unit,
              }}
              onClose={() => setForwardOpen(false)}
              onShared={() => {
                void queryClient.invalidateQueries({ queryKey: ['receivedDetail', shareId] });
                void queryClient.invalidateQueries({ queryKey: ['forwardShares', shareId] });
              }}
            />
          ) : null}
        </>
      ) : null}
    </ScreenBackground>
  );
}

function Detail({
  data,
  onReserve,
  onShare,
  onEdit,
}: {
  data: ReceivedShareDetail;
  onReserve: () => void;
  onShare: () => void;
  onEdit: () => void;
}): React.JSX.Element {
  // Meta shows the RECEIVED DATE, not a relative "ago".
  const meta = [
    data.product_code ?? '—',
    (data.category ?? 'General').toUpperCase(),
    `RECEIVED ${new Date(data.created_at).toLocaleDateString()}`,
  ].join('  •  ');

  const phone = data.shared_by_phone;

  return (
    <>
      <PhotoCarousel urls={data.photoUrls} fallbackName={data.title} />

      <Card style={styles.card}>
        <Text style={styles.meta}>{meta}</Text>
        <Text style={styles.title}>{data.title}</Text>

        <View style={styles.kv}>
          <KeyValue label="Stock location" value={data.stock_location || '—'} />
          <KeyValue label="Origin" value={data.origin || '—'} />
          <KeyValue label="Price" value={priceText(data)} valueColor={colors.green} last />
        </View>

        <StatsStrip
          stats={[
            { label: 'TOTAL QTY', value: data.quantity.toLocaleString(), unit: data.unit, color: colors.navy },
            { label: 'AVAILABLE', value: data.available_to_me.toLocaleString(), unit: data.unit, color: colors.green },
            { label: 'I RESERVED', value: data.reserved_by_me.toLocaleString(), unit: data.unit, color: '#E08A00' },
            { label: 'SHARED WITH', value: String(data.shared_with), unit: 'contacts', color: colors.violet },
          ]}
        />
      </Card>

      {/* Reserve (green) / Share / Edit */}
      <View style={styles.actions}>
        <Button label="Reserve" variant="green" icon={<Icon name="box" size={18} color="#FFFFFF" />} onPress={onReserve} style={styles.reserveBtn} />
        <Button label="Share" variant="ghost" icon={<Icon name="share" size={17} color={colors.navy} />} onPress={onShare} style={styles.smallBtn} />
        <Button label="Edit" variant="ghost" icon={<Icon name="edit" size={17} color={colors.navy} />} onPress={onEdit} style={styles.smallBtn} />
      </View>

      {data.forward_remark ? (
        <View style={styles.remark}>
          <Text style={styles.remarkText}>{data.forward_remark}</Text>
        </View>
      ) : null}

      {data.description ? (
        <Card style={styles.section}>
          <View style={styles.head}>
            <Icon name="doc" size={18} color={colors.navy} />
            <Text style={styles.headTitle}>Details</Text>
          </View>
          <Text style={styles.body}>{data.description}</Text>
        </Card>
      ) : null}

      {data.files.length > 0 ? (
        <Card style={styles.section}>
          <View style={styles.head}>
            <Icon name="doc" size={18} color={colors.navy} />
            <Text style={styles.headTitle}>Packing list and spec sheets</Text>
          </View>
          <View style={styles.docs}>
            {data.files.map((f) => (
              <DocRow key={f.url} filename={f.name} onOpen={() => Linking.openURL(f.url)} />
            ))}
          </View>
        </Card>
      ) : null}

      {/* Shared by — WhatsApp uses the OFFICIAL full-colour logo. */}
      <Card style={styles.section}>
        <View style={styles.head}>
          <Icon name="user" size={18} color={colors.navy} />
          <Text style={styles.headTitle}>Shared by</Text>
        </View>
        <View style={styles.sharedRow}>
          <Avatar name={data.shared_by_company ?? 'Vendor'} size={45} gradient="nav" />
          <View style={styles.sharedInfo}>
            <Text style={styles.sharedName} numberOfLines={1}>
              {data.shared_by_company ?? 'A vendor'}
            </Text>
            {data.contact_person ? (
              <Text style={styles.sharedContact} numberOfLines={1}>
                Contact: {data.contact_person}
              </Text>
            ) : null}
          </View>
        </View>
        {phone || data.shared_by_email ? (
          <View style={styles.contactBtns}>
            {phone ? (
              <Pressable style={[styles.contactBtn, styles.contactGreen]} onPress={() => Linking.openURL(`tel:${phone}`)}>
                <Icon name="phone" size={19} color={colors.green} />
              </Pressable>
            ) : null}
            {phone ? (
              <Pressable style={[styles.contactBtn, styles.contactGreen]} onPress={() => Linking.openURL(`https://wa.me/${waNumber(phone)}`)}>
                <WhatsAppLogo size={24} variant="color" />
              </Pressable>
            ) : null}
            {data.shared_by_email ? (
              <Pressable style={[styles.contactBtn, styles.contactBlue]} onPress={() => Linking.openURL(`mailto:${data.shared_by_email}`)}>
                <Icon name="mail" size={19} color={colors.blue} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  errorText: { color: colors.muted, fontSize: 14, textAlign: 'center' },

  card: { marginTop: 12 },
  meta: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.7, color: colors.muted },
  title: { fontSize: 23, fontWeight: '800', color: colors.navy, letterSpacing: -0.4, marginTop: 6 },
  kv: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 12 },

  actions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  reserveBtn: { flex: 1.7 },
  smallBtn: { flex: 1 },

  remark: {
    backgroundColor: 'rgba(255,249,236,0.92)',
    borderWidth: 1,
    borderColor: '#F0E0BC',
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
  },
  remarkText: { fontSize: 13, color: '#6B5518', lineHeight: 19 },

  section: { marginTop: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headTitle: { fontSize: 16, fontWeight: '800', color: colors.navy },
  body: { fontSize: 14.5, color: colors.text, marginTop: 10, lineHeight: 21 },
  docs: { marginTop: 10 },

  sharedRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 12 },
  sharedInfo: { flex: 1, minWidth: 0 },
  sharedName: { fontSize: 15.5, fontWeight: '700', color: colors.navy },
  sharedContact: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  contactBtns: { flexDirection: 'row', gap: 11, marginTop: 12 },
  contactBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  contactGreen: { backgroundColor: 'rgba(20,154,84,0.12)', borderColor: 'rgba(20,154,84,0.2)' },
  contactBlue: { backgroundColor: 'rgba(46,124,246,0.12)', borderColor: 'rgba(46,124,246,0.2)' },
});
