import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { supabase } from '../services/supabase/client';
import {
  acceptConnection,
  getVendorProfile,
  rejectConnection,
  removeNetworkVendor,
  type VendorProfile,
} from '../services/supabase/network';
import { AppButton } from '../components/shared/AppButton';
import { ErrorState, LoadingState } from '../components/shared/StateView';
import { openCall, openEmail, openWhatsApp } from '../utils/contact';
import { confirmAction } from '../utils/confirm';
import { toast } from '../stores/toast';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'VendorDetail'>;

type Mode = 'connected' | 'pending' | 'manual';

interface VendorDetailData {
  mode: Mode;
  company: string | null;
  contactPerson: string | null;
  email: string | null;
  mobile: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  group: string | null;
  connectionId: string | null;
  manualId: string | null;
  connectedSince: string | null;
  sharedWith: number;
  receivedFrom: number;
  isRegistered: boolean;
}

interface ManualRow {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  mobile_number: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  group_name: string | null;
  is_registered: boolean | null;
}

function monthYear(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function initials(name: string | null): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts.slice(0, 2).map((p) => p[0] ?? '').join('') || name[0]).toUpperCase();
}

async function loadVendorDetail(vendorId?: string, manualVendorId?: string): Promise<VendorDetailData> {
  if (manualVendorId) {
    const { data, error } = await supabase
      .from('manual_vendors')
      .select('id, company_name, contact_person, email, mobile_number, industry, country, city, group_name, is_registered')
      .eq('id', manualVendorId)
      .single();
    if (error || !data) throw error ?? new Error('Vendor not found.');
    const m = data as ManualRow;
    return {
      mode: 'manual',
      company: m.company_name,
      contactPerson: m.contact_person,
      email: m.email,
      mobile: m.mobile_number,
      industry: m.industry,
      country: m.country,
      city: m.city,
      group: m.group_name,
      connectionId: null,
      manualId: m.id,
      connectedSince: null,
      sharedWith: 0,
      receivedFrom: 0,
      isRegistered: Boolean(m.is_registered),
    };
  }

  if (!vendorId) throw new Error('Vendor not found.');
  const p: VendorProfile = await getVendorProfile(vendorId);
  return {
    mode: p.status === 'pending' ? 'pending' : 'connected',
    company: p.company_name,
    contactPerson: p.contact_person,
    email: p.email,
    mobile: p.mobile_number,
    industry: p.industry,
    country: p.country,
    city: p.city,
    group: p.group_name,
    connectionId: p.connection_id,
    manualId: null,
    connectedSince: p.connected_since,
    sharedWith: p.shared_with_count,
    receivedFrom: p.received_from_count,
    isRegistered: true,
  };
}

export function VendorDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { vendorId, manualVendorId } = route.params;
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendorDetail', vendorId ?? manualVendorId],
    queryFn: () => loadVendorDetail(vendorId, manualVendorId),
    staleTime: 30_000,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['network'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const acceptMutation = useMutation({
    mutationFn: acceptConnection,
    onSuccess: () => {
      invalidate();
      void refetch();
    },
    onError: (e) => Alert.alert('Could not accept', e instanceof Error ? e.message : 'Try again.'),
  });
  const rejectMutation = useMutation({
    mutationFn: rejectConnection,
    onSuccess: () => {
      invalidate();
      navigation.goBack();
    },
    onError: (e) => Alert.alert('Could not reject', e instanceof Error ? e.message : 'Try again.'),
  });
  const removeMutation = useMutation({
    mutationFn: ({ source, id }: { source: 'connection' | 'manual'; id: string }) => removeNetworkVendor(source, id),
    onSuccess: () => {
      invalidate();
      toast.delete('Removed from your network.');
      navigation.goBack();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not remove vendor.'),
  });

  if (isLoading) {
    return (
      <View style={styles.fill}>
        <Header onBack={() => navigation.goBack()} />
        <LoadingState />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.fill}>
        <Header onBack={() => navigation.goBack()} />
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load.'}
          onRetry={() => void refetch()}
        />
      </View>
    );
  }

  const confirmRemove = (): void => {
    const isManual = data.mode === 'manual';
    confirmAction({
      title: isManual ? 'Remove contact?' : 'Remove connection?',
      message: isManual
        ? 'This deletes the manual contact from your network.'
        : 'You will no longer be connected with this vendor.',
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () =>
        removeMutation.mutate(
          isManual
            ? { source: 'manual', id: data.manualId ?? '' }
            : { source: 'connection', id: data.connectionId ?? '' },
        ),
    });
  };

  const statusChip =
    data.mode === 'pending'
      ? { label: 'Pending', bg: colors.amberBg, fg: colors.amber }
      : data.mode === 'manual'
        ? { label: data.isRegistered ? 'On MyStokk' : 'Manual', bg: colors.slate100, fg: colors.slate500 }
        : { label: 'Connected', bg: colors.emeraldBg, fg: colors.emerald };

  return (
    <View style={styles.fill}>
      <Header
        onBack={() => navigation.goBack()}
        onEdit={() =>
          navigation.navigate(
            'EditVendor',
            data.mode === 'manual' ? { manualVendorId: data.manualId ?? undefined } : { vendorId: vendorId ?? undefined },
          )
        }
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(data.company)}</Text>
          </View>
          <Text style={styles.company}>{data.company ?? 'Vendor'}</Text>
          {data.contactPerson ? <Text style={styles.contact}>{data.contactPerson}</Text> : null}
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: statusChip.bg }]}>
              <Text style={[styles.chipText, { color: statusChip.fg }]}>{statusChip.label}</Text>
            </View>
            {data.industry ? (
              <View style={[styles.chip, { backgroundColor: colors.slate100 }]}>
                <Text style={[styles.chipText, { color: colors.slate700 }]}>{data.industry}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.content}>
          {/* Quick actions — Accept/Reject for pending, else WhatsApp/Call/Email */}
          {data.mode === 'pending' ? (
            <View style={styles.actionRow}>
              <AppButton
                title="Accept"
                style={styles.flex1}
                loading={acceptMutation.isPending}
                onPress={() => data.connectionId && acceptMutation.mutate(data.connectionId)}
              />
              <AppButton
                title="Reject"
                variant="outline"
                style={styles.flex1}
                loading={rejectMutation.isPending}
                onPress={() => data.connectionId && rejectMutation.mutate(data.connectionId)}
              />
            </View>
          ) : (
            <View style={styles.actionRow}>
              <Pressable style={[styles.qa, { backgroundColor: colors.emerald }]} onPress={() => openWhatsApp(data.mobile)}>
                <Text style={styles.qaLight}>💬 WhatsApp</Text>
              </Pressable>
              <Pressable style={styles.qaOutline} onPress={() => openCall(data.mobile)}>
                <Text style={styles.qaDark}>📞 Call</Text>
              </Pressable>
              <Pressable style={styles.qaOutline} onPress={() => openEmail(data.email)}>
                <Text style={styles.qaDark}>✉️ Email</Text>
              </Pressable>
            </View>
          )}

          {/* Contact Information */}
          <Section title="Contact Information">
            <DetailRow label="Email" value={data.email ?? '—'} />
            <DetailRow label="Mobile" value={data.mobile ?? '—'} />
            <DetailRow label="Location" value={[data.city, data.country].filter(Boolean).join(', ') || '—'} />
            <DetailRow label="Group" value={data.group ?? '—'} />
          </Section>

          {/* Activity — only for an established connection */}
          {data.mode === 'connected' ? (
            <Section title="Activity">
              <DetailRow label="Items shared with them" value={String(data.sharedWith)} />
              <DetailRow label="Items received from them" value={String(data.receivedFrom)} />
              <DetailRow label="Connected since" value={monthYear(data.connectedSince)} />
            </Section>
          ) : data.mode === 'manual' && !data.isRegistered ? (
            <View style={styles.note}>
              <Text style={styles.noteText}>
                Manual contact — not on MyStokk yet. They'll be promoted to a full connection automatically if they
                sign up with this email.
              </Text>
            </View>
          ) : null}

          {/* Remove — hidden for pending (use Reject instead) */}
          {data.mode !== 'pending' ? (
            <Pressable
              style={({ pressed }) => [styles.remove, pressed ? styles.removePressed : null]}
              onPress={confirmRemove}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? (
                <ActivityIndicator color={colors.red} />
              ) : (
                <Text style={styles.removeText}>{data.mode === 'manual' ? 'Remove Contact' : 'Remove Connection'}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Header({ onBack, onEdit }: { onBack: () => void; onEdit?: () => void }): React.JSX.Element {
  return (
    <SafeAreaView edges={['top']} style={styles.headerSafe}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.headerSide}>
          <Text style={styles.headerIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Vendor Profile</Text>
        {onEdit ? (
          <Pressable onPress={onEdit} hitSlop={10} style={[styles.headerSide, { alignItems: 'flex-end' }]}>
            <Text style={styles.headerIcon}>✏️</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSide} />
        )}
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },

  headerSafe: { backgroundColor: colors.navy },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  headerSide: { width: 34, alignItems: 'flex-start' },
  headerIcon: { color: '#FFFFFF', fontSize: 24, fontWeight: '600' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  identity: { backgroundColor: '#FFFFFF', alignItems: 'center', paddingVertical: 24, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  avatar: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 22 },
  company: { fontSize: 17, fontWeight: '800', color: colors.slate900, textAlign: 'center' },
  contact: { fontSize: 12.5, color: colors.slate500, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700' },

  content: { padding: 16 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  flex1: { flex: 1 },
  qa: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  qaOutline: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.slate200 },
  qaLight: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  qaDark: { color: colors.navy, fontWeight: '700', fontSize: 13 },

  section: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginTop: 14, borderWidth: 1, borderColor: colors.slate100 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.slate900, marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
  detailLabel: { fontSize: 13, color: colors.slate500, flexShrink: 1 },
  detailValue: { fontSize: 13, fontWeight: '600', color: colors.slate700, textAlign: 'right', flexShrink: 1 },

  note: { backgroundColor: colors.blueBg, borderRadius: 12, padding: 14, marginTop: 14 },
  noteText: { fontSize: 12, color: colors.blue, lineHeight: 18 },

  remove: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.redBg,
    borderWidth: 1.5,
    borderColor: colors.redBg,
  },
  removePressed: { opacity: 0.85 },
  removeText: { color: colors.red, fontWeight: '700', fontSize: 15 },
});
