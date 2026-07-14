import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassPanel } from './GlassPanel';
import { Icon, type IconName } from './Icon';
import { colors, radii } from './theme';

/* ---------------- Search pill ---------------- */

/** Tappable search affordance (.searchpill). */
export function SearchPill({
  placeholder = 'Search…',
  onPress,
  style,
}: {
  placeholder?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={style}>
      <GlassPanel effect="clear" radius={radii.row} style={styles.searchPill}>
        <Icon name="search" size={18} color={colors.muted} />
        <Text style={styles.searchText}>{placeholder}</Text>
      </GlassPanel>
    </Pressable>
  );
}

/* ---------------- Key / value ---------------- */

/** Spec line inside a detail card (.kv). */
export function KeyValue({
  label,
  value,
  valueColor,
  last = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.kv, !last && styles.kvBorder]}>
      <Text style={styles.k}>{label}</Text>
      <Text style={[styles.v, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

/* ---------------- Stock bar ---------------- */

/** Available / reserved split bar (.stockbar). */
export function StockBar({
  total,
  available,
  reserved,
  height = 5,
}: {
  total: number;
  available: number;
  reserved: number;
  height?: number;
}): React.JSX.Element {
  const pct = (n: number): `${number}%` => `${total > 0 ? (n / total) * 100 : 0}%`;
  return (
    <View style={[styles.stockBar, { height, borderRadius: height / 2 }]}>
      <View style={{ width: pct(available), backgroundColor: colors.stockAvailable }} />
      <View style={{ width: pct(reserved), backgroundColor: colors.stockReserved }} />
    </View>
  );
}

/* ---------------- Steps ---------------- */

/** Wizard progress bar (.steps) — onboarding, share flows. */
export function Steps({ total, current }: { total: number; current: number }): React.JSX.Element {
  return (
    <View style={styles.steps}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.step, i < current && styles.stepOn]} />
      ))}
    </View>
  );
}

/* ---------------- Notes ---------------- */

/** Amber caution note (.note) — e.g. "the supplier's price will NOT be shared". */
export function Note({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={[styles.note, styles.noteAmber]}>
      <Icon name="lock" size={20} color={colors.amber} />
      <Text style={[styles.noteText, styles.noteTextAmber]}>{children}</Text>
    </View>
  );
}

/** Blue informational note (.infonote) — privacy-chain explainers. */
export function InfoNote({
  icon = 'shield',
  children,
}: {
  icon?: IconName;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={[styles.note, styles.noteBlue]}>
      <Icon name={icon} size={20} color={colors.blue} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

/* ---------------- Document row ---------------- */

const EXT_COLOR: Record<string, string> = {
  pdf: colors.red,
  doc: colors.blueDark,
  docx: colors.blueDark,
  xls: colors.green,
  xlsx: colors.green,
  csv: colors.green,
};

/** Attached file row (.doc) — colour-coded by extension. */
export function DocRow({
  filename,
  onOpen,
  onRemove,
}: {
  filename: string;
  onOpen?: () => void;
  onRemove?: () => void;
}): React.JSX.Element {
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  const tint = EXT_COLOR[ext] ?? colors.muted;

  return (
    <GlassPanel effect="clear" radius={radii.doc} style={styles.doc}>
      <Icon name="doc" size={20} color={tint} />
      <Text style={styles.docName} numberOfLines={1}>
        {filename}
      </Text>
      {onOpen ? (
        <Pressable onPress={onOpen} style={styles.docOpen}>
          <Text style={styles.docOpenText}>Open</Text>
          <Icon name="open" size={14} color={colors.blue} />
        </Pressable>
      ) : (
        <Text style={[styles.docExt, { color: tint }]}>{ext.toUpperCase()}</Text>
      )}
      {onRemove ? (
        <Pressable onPress={onRemove} style={styles.docRemove}>
          <Text style={styles.docRemoveText}>×</Text>
        </Pressable>
      ) : null}
    </GlassPanel>
  );
}

/* ---------------- Stat card ---------------- */

/** Dashboard metric tile (.stat). */
export function StatCard({
  icon,
  tint,
  tintBg,
  value,
  label,
  onPress,
}: {
  icon: IconName;
  tint: string;
  tintBg: string;
  value: string | number;
  label: string;
  onPress?: () => void;
}): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.statWrap, pressed && styles.pressed]}>
      <GlassPanel radius={radii.row} style={styles.stat}>
        <View style={[styles.statIcon, { backgroundColor: tintBg }]}>
          <Icon name={icon} size={20} color={tint} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </GlassPanel>
    </Pressable>
  );
}

/* ---------------- Negotiation bubble ---------------- */

/** Chat bubble in the negotiation thread (.bubble). */
export function Bubble({
  who,
  round,
  headline,
  note,
  time,
  mine = false,
}: {
  who: string;
  round: string;
  headline: string;
  note?: string;
  time: string;
  mine?: boolean;
}): React.JSX.Element {
  return (
    <GlassPanel
      effect="clear"
      radius={16}
      fill={mine ? 'rgba(100,170,255,0.2)' : 'rgba(255,255,255,0.16)'}
      style={[styles.bubble, mine && styles.bubbleMine]}
    >
      <View style={styles.bubbleWho}>
        <Text style={styles.bubbleWhoText}>{who}</Text>
        <Text style={styles.bubbleWhoText}>{round}</Text>
      </View>
      <Text style={styles.bubbleBig}>{headline}</Text>
      {note ? <Text style={styles.bubbleNote}>“{note}”</Text> : null}
      <Text style={styles.bubbleTime}>{time}</Text>
    </GlassPanel>
  );
}

/* ---------------- Toggle ---------------- */

/** iOS switch (.toggle) — settings. */
export function Toggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }): React.JSX.Element {
  return (
    <Pressable onPress={() => onChange(!value)} style={[styles.toggle, value && styles.toggleOn]}>
      <View style={[styles.knob, value && styles.knobOn]} />
    </Pressable>
  );
}

/* ---------------- Empty state ---------------- */

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: IconName;
  title: string;
  message: string;
}): React.JSX.Element {
  return (
    <View style={styles.empty}>
      <GlassPanel effect="clear" radius={24} style={styles.emptyIcon}>
        <Icon name={icon} size={32} color={colors.blue} />
      </GlassPanel>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchPill: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 45, paddingHorizontal: 14 },
  searchText: { color: colors.muted, fontSize: 15 },

  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, paddingVertical: 11 },
  kvBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  k: { color: colors.muted, fontWeight: '600', fontSize: 14.5 },
  v: { fontWeight: '800', color: colors.navy, fontSize: 14.5, textAlign: 'right', flexShrink: 1 },

  stockBar: { flexDirection: 'row', overflow: 'hidden', backgroundColor: '#EDF1F8', marginTop: 7 },

  steps: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 16 },
  step: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E2E8F2' },
  stepOn: { backgroundColor: colors.blue },

  note: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderRadius: 14, padding: 13, borderWidth: 1 },
  noteAmber: { backgroundColor: 'rgba(255,205,110,0.18)', borderColor: 'rgba(240,224,188,0.9)' },
  noteBlue: { backgroundColor: 'rgba(110,175,255,0.14)', borderColor: 'rgba(214,229,251,0.9)' },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19.5, color: colors.text },
  noteTextAmber: { color: '#6B5518' },

  doc: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 9 },
  docName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.navy },
  docExt: { fontSize: 11.5, fontWeight: '800' },
  docOpen: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  docOpenText: { color: colors.blue, fontWeight: '800', fontSize: 13.5 },
  docRemove: { paddingLeft: 10 },
  docRemoveText: { color: colors.muted, fontWeight: '800', fontSize: 16 },

  statWrap: { flex: 1 },
  stat: { padding: 14 },
  statIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.navy, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: '700', marginTop: 1 },

  bubble: { maxWidth: '82%', padding: 11, paddingHorizontal: 14, marginBottom: 10, alignSelf: 'flex-start' },
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleWho: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, marginBottom: 3 },
  bubbleWhoText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: colors.muted, textTransform: 'uppercase' },
  bubbleBig: { fontSize: 15, fontWeight: '800', color: colors.navy },
  bubbleNote: { fontStyle: 'italic', color: colors.muted, marginTop: 2, fontSize: 14 },
  bubbleTime: { fontSize: 11, color: '#9AA7BF', marginTop: 5 },

  toggle: { width: 51, height: 31, borderRadius: 16, backgroundColor: '#E9E9EB', padding: 2 },
  toggleOn: { backgroundColor: '#34C759' },
  knob: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  knobOn: { marginLeft: 20 },

  empty: { alignItems: 'center', paddingVertical: 54, paddingHorizontal: 30 },
  emptyIcon: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16.5, fontWeight: '800', color: colors.navy, marginBottom: 5 },
  emptyText: { fontSize: 13.5, lineHeight: 20, color: colors.muted, textAlign: 'center' },

  pressed: { transform: [{ scale: 0.97 }] },
});
