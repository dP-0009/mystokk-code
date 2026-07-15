import React from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import {
  deleteInventory,
  getInventoryDetail,
  type InventoryDetail,
} from '../services/supabase/inventory';
import { ShareModal } from '../components/share/ShareModal';
import { confirmAction } from '../utils/confirm';
import { toast } from '../stores/toast';
import {
  Button,
  Card,
  DocRow,
  Icon,
  KeyValue,
  NavBar,
  PhotoCarousel,
  ScreenBackground,
  StatsStrip,
  colors,
  layout,
  relativeTimeShort,
  spacing,
} from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'InventoryDetail'>;

/** Item detail (prototype SCREENS.item). Bound to getInventoryDetail + deleteInventory. */
export function InventoryDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { inventoryId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = React.useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventoryDetail', inventoryId],
    queryFn: () => getInventoryDetail(inventoryId),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInventory(inventoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.delete('Item deleted successfully!');
      navigation.goBack();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not delete item.'),
  });

  const confirmDelete = (): void => {
    confirmAction({
      title: 'Delete item?',
      message: `“${data?.item.title ?? 'This item'}” will be permanently removed.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deleteMutation.mutate(),
    });
  };

  return (
    <ScreenBackground>
      <NavBar title="Item" onBack={() => navigation.goBack()} />

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
          <Body data={data} onShare={() => setShareOpen(true)} onEdit={() => navigation.navigate('InventoryEdit', { inventoryId })} onDelete={confirmDelete} />
        </ScrollView>
      )}

      <ShareModal
        visible={shareOpen}
        inventoryId={inventoryId}
        card={
          data
            ? {
                title: data.item.title,
                quantityAvailable: data.item.quantity_available,
                quantityTotal: data.item.quantity,
                unit: data.item.unit,
              }
            : undefined
        }
        onClose={() => setShareOpen(false)}
        onShared={() => {
          void queryClient.invalidateQueries({ queryKey: ['inventoryDetail', inventoryId] });
          void queryClient.invalidateQueries({ queryKey: ['inventory'] });
        }}
      />
    </ScreenBackground>
  );
}

function Body({
  data,
  onShare,
  onEdit,
  onDelete,
}: {
  data: InventoryDetail;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  const { item, photoUrls, documents, shareActivity } = data;
  const reserved = Math.max(item.quantity - item.quantity_available, 0);

  const meta = [item.product_code, item.category, relativeTimeShort(item.created_at).toUpperCase()]
    .filter(Boolean)
    .join('  •  ');

  const priceText =
    item.price === null ? 'Price on request' : `${item.currency} ${item.price.toLocaleString()} / ${item.unit}`;

  const openDoc = (url: string): void => {
    if (url) void Linking.openURL(url);
  };

  return (
    <>
      <PhotoCarousel urls={photoUrls} fallbackName={item.title} />

      <Card style={styles.card}>
        <Text style={styles.meta}>{meta}</Text>
        {/* Title WITHOUT a status badge (item 2). */}
        <Text style={styles.title}>{item.title}</Text>

        <View style={styles.kv}>
          <KeyValue label="Stock location" value={item.stock_location ?? '—'} />
          <KeyValue label="Origin" value={item.origin ?? '—'} />
          <KeyValue label="Price" value={priceText} valueColor={colors.green} last />
        </View>

        <StatsStrip
          stats={[
            { label: 'TOTAL QTY', value: item.quantity.toLocaleString(), unit: item.unit, color: colors.navy },
            { label: 'AVAILABLE', value: item.quantity_available.toLocaleString(), unit: item.unit, color: colors.green },
            { label: 'RESERVED', value: reserved.toLocaleString(), unit: item.unit, color: '#E08A00' },
            { label: 'SHARED WITH', value: String(item.shared_count), unit: 'contacts', color: colors.violet },
          ]}
        />
      </Card>

      <View style={styles.actions}>
        <Button
          label="Share"
          variant="dark"
          icon={<Icon name="share" size={19} color="#FFFFFF" />}
          onPress={onShare}
          style={styles.shareBtn}
        />
        <Button
          label="Edit"
          variant="ghost"
          icon={<Icon name="edit" size={18} color={colors.navy} />}
          onPress={onEdit}
          style={styles.editBtn}
        />
      </View>

      {item.description ? (
        <Card style={styles.section}>
          <View style={styles.sectionHead}>
            <Icon name="doc" size={18} color={colors.navy} />
            <Text style={styles.sectionTitle}>Description</Text>
          </View>
          <Text style={styles.body}>{item.description}</Text>
        </Card>
      ) : null}

      {documents.length > 0 ? (
        <Card style={styles.section}>
          <View style={styles.sectionHead}>
            <Icon name="inbox" size={18} color={colors.navy} />
            <Text style={styles.sectionTitle}>Documents</Text>
          </View>
          <View style={styles.docs}>
            {documents.map((d) => (
              <DocRow key={d.storage_path} filename={d.name} onOpen={() => openDoc(d.url)} />
            ))}
          </View>
        </Card>
      ) : null}

      <Card style={styles.section}>
        <View style={styles.sectionHead}>
          <Icon name="clock" size={18} color={colors.navy} />
          <Text style={styles.sectionTitle}>Activity</Text>
        </View>
        <View style={styles.activityRow}>
          <View style={styles.activityDot} />
          <Text style={styles.activityText}>Created inventory</Text>
          <Text style={styles.activityTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        {shareActivity.map((a, i) => (
          <View key={`${a.recipient_company}-${i}`} style={styles.activityRow}>
            <View style={styles.activityDot} />
            <Text style={styles.activityText} numberOfLines={1}>
              Shared with {a.recipient_company ?? 'a vendor'}
            </Text>
            <Text style={styles.activityTime}>{new Date(a.shared_at).toLocaleDateString()}</Text>
          </View>
        ))}
      </Card>

      <Button
        label="Delete Item"
        variant="danger"
        icon={<Icon name="trash" size={18} color={colors.red} />}
        onPress={onDelete}
        style={styles.deleteBtn}
      />
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

  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  shareBtn: { flex: 2.3 },
  editBtn: { flex: 1 },

  section: { marginTop: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.navy },
  body: { fontSize: 14.5, color: colors.text, marginTop: 10, lineHeight: 21 },
  docs: { marginTop: 10 },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12 },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C9D4E6' },
  activityText: { flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.navy },
  activityTime: { fontSize: 13, color: colors.muted },

  deleteBtn: { marginTop: 16, marginBottom: 6 },
});
