import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Badge,
  Bubble,
  Button,
  Card,
  CategoryChip,
  CategoryChipGroup,
  Chip,
  ChipRow,
  DocRow,
  EmptyState,
  FabSpeedDial,
  GlassPanel,
  Icon,
  InfoNote,
  KeyValue,
  NavBar,
  NavButton,
  Note,
  Popover,
  QtyStepper,
  Row,
  ScreenBackground,
  SearchPill,
  SectionLabel,
  SegmentedControl,
  Select,
  Sheet,
  SheetAction,
  StatCard,
  StatusBadge,
  Steps,
  StockBar,
  TabBar,
  TextArea,
  TextField,
  Thumb,
  Toggle,
  UnderlineTabs,
  WhatsAppLogo,
  buttonTextColor,
  colors,
  glass,
  gradients,
  layout,
  spacing,
  type IconName,
} from '../components/mobile';

const ALL_ICONS: IconName[] = [
  'home', 'box', 'inbox', 'cal', 'net',
  'back', 'chev', 'down', 'up', 'open',
  'search', 'plus', 'check', 'bell', 'share',
  'copy', 'wa', 'mail', 'phone', 'eye',
  'edit', 'trash', 'lock', 'camera', 'doc',
  'user', 'gear', 'help', 'off', 'clock',
  'hand', 'bulk', 'loc', 'shield', 'import',
  'filter', 'dots',
];

/**
 * Dev-only gallery of the whole mobile design system, for on-phone review.
 * Native only, and gated behind __DEV__ at the route — it can never ship.
 */
export function DesignSystemScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const [seg, setSeg] = React.useState('received');
  const [utab, setUtab] = React.useState('network');
  const [tab, setTab] = React.useState('home');
  const [chip, setChip] = React.useState('7d');
  const [cats, setCats] = React.useState<string[]>(['Timber']);
  const [qty, setQty] = React.useState(1000);
  const [push, setPush] = React.useState(true);
  const [sheet, setSheet] = React.useState(false);
  const [pop, setPop] = React.useState(false);

  const toggleCat = (c: string): void =>
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <ScreenBackground>
      <NavBar title="Design system" right={<NavButton icon="bell" badge onPress={() => setPop(true)} />} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 60, paddingBottom: layout.bottomPadTab + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <SectionLabel>Buttons</SectionLabel>
        <View style={styles.stack}>
          <Button label="Create free account" variant="primary" icon={<Icon name="plus" size={18} color="#fff" />} />
          <Button label="Share" variant="dark" icon={<Icon name="share" size={19} color="#fff" />} />
          <Button label="Edit" variant="ghost" icon={<Icon name="edit" size={18} color={colors.navy} />} />
          <Button label="Done" variant="soft" />
          <Button label="WhatsApp" variant="green" icon={<WhatsAppLogo size={19} variant="glyph" />} />
          <Button
            label="Delete Item"
            variant="danger"
            icon={<Icon name="trash" size={18} color={buttonTextColor.danger} />}
          />
          <View style={styles.rowGap}>
            <Button label="Small ghost" variant="ghost" size="sm" style={styles.flex} />
            <Button label="Disabled" variant="primary" size="sm" disabled style={styles.flex} />
          </View>
        </View>

        <SectionLabel>Glass ladder</SectionLabel>
        <Text style={styles.help}>
          Popups sit above cards, so they are brighter — otherwise they read as dull.
        </Text>
        <View style={styles.stack}>
          {([
            ['Card / panel', glass.fillPanel],
            ['Tab bar', glass.fillTabBar],
            ['Input', glass.fillInput],
            ['FAB menu', glass.fillFabMenu],
            ['Popover', glass.fillPopover],
            ['Sheet', glass.fillSheet],
          ] as const).map(([label, fill]) => (
            <GlassPanel key={label} radius={16} fill={fill} style={styles.ladder}>
              <Text style={styles.ladderText}>{label}</Text>
              <Text style={styles.ladderVal}>{fill}</Text>
            </GlassPanel>
          ))}
        </View>

        <SectionLabel>Cards & rows</SectionLabel>
        <Card>
          <KeyValue label="Stock location" value="Central Warehouse, Zone B" />
          <KeyValue label="Origin" value="UAE" />
          <KeyValue label="Price" value="USD 50,00,000 / unit" valueColor={colors.green} last />
          <StockBar total={225} available={163} reserved={62} />
        </Card>
        <View style={styles.gap} />
        <Row
          leading={<Thumb name="BURJ KHALIFA" size={52} />}
          title="eco wants to reserve BURJ KHALIFA — a very long title that clamps to two lines"
          subtitle="50 unit · offered USD 40,00,000 · 1d ago"
          trailing={<Badge label="Pending" tone="amber" />}
          clamp
        />
        <Row
          leading={<Avatar name="ADCB" size={45} />}
          title="ADCB shared WhiteWood Pine"
          subtitle="50,000 unit @ AED 840 · London"
          trailing={<Icon name="chev" size={17} color={colors.chev} />}
        />

        <SectionLabel>Stats</SectionLabel>
        <View style={styles.rowGap}>
          <StatCard icon="box" tint={colors.blue} tintBg={colors.ice} value={5} label="My Inventory" />
          <StatCard icon="inbox" tint={colors.green} tintBg={colors.greenBg} value={4} label="Received" />
        </View>
        <View style={[styles.rowGap, styles.gap]}>
          <StatCard icon="cal" tint={colors.violet} tintBg={colors.violetBg} value={6} label="Reservations" />
          <StatCard icon="net" tint={colors.amber} tintBg={colors.amberBg} value={9} label="My Network" />
        </View>

        <SectionLabel>Badges</SectionLabel>
        <View style={styles.wrap}>
          {['Active', 'Partially Reserved', 'Sold Out', 'Pending', 'Confirmed', 'Rejected', 'Cancelled', 'Connected', 'Manual', 'New'].map(
            (s) => (
              <StatusBadge key={s} status={s} />
            ),
          )}
        </View>

        <SectionLabel>Selection</SectionLabel>
        <SegmentedControl
          segments={[
            { key: 'received', label: 'Received (4)', icon: <Icon name="down" size={14} color={seg === 'received' ? colors.navy : colors.muted} /> },
            { key: 'sent', label: 'Sent (2)', icon: <Icon name="up" size={14} color={seg === 'sent' ? colors.navy : colors.muted} /> },
          ]}
          value={seg}
          onChange={setSeg}
        />
        <UnderlineTabs
          tabs={[
            { key: 'network', label: 'Network', count: 9 },
            { key: 'pending', label: 'Pending', count: 1 },
          ]}
          value={utab}
          onChange={setUtab}
        />
        <View style={styles.gap} />
        <ChipRow>
          {[['24h', '24 h'], ['7d', '7 days'], ['30d', '30 days'], ['never', 'Never']].map(([k, l]) => (
            <Chip key={k} label={l as string} selected={chip === k} onPress={() => setChip(k as string)} />
          ))}
        </ChipRow>
        <CategoryChipGroup>
          {['Timber', 'Electronics', 'Auto Parts', 'Polymers & Plastics', 'Others'].map((c) => (
            <CategoryChip key={c} label={c} selected={cats.includes(c)} onPress={() => toggleCat(c)} />
          ))}
        </CategoryChipGroup>

        <SectionLabel>Forms</SectionLabel>
        <SearchPill placeholder="Search items…" style={styles.gap} />
        <View style={styles.gap} />
        <TextField label="Title" required placeholder="e.g., Premium Cotton Fabric" />
        <Select label="Industry" placeholder="Select industry (optional)" value="Timber & Wood" />
        <View style={styles.rowGap}>
          <View style={styles.flex}>
            <Text style={styles.label}>Quantity *</Text>
            <QtyStepper value={qty} onChange={setQty} step={100} max={50000} />
          </View>
          <View style={styles.flex}>
            <TextField label="Price per unit" placeholder="840" inputMode="decimal" />
          </View>
        </View>
        <TextArea label="Description" placeholder="Specs, packaging, MOQ…" />
        <TextField label="Quantity" error="Exceeds available quantity (max 50,000 unit)" value="60,000" />

        <SectionLabel>Notes</SectionLabel>
        <Note>The original supplier's price will not be shared. Set your own price before sharing.</Note>
        <View style={styles.gap} />
        <InfoNote>ADCB's identity and original price stay hidden — the MyStokk privacy chain protects every link.</InfoNote>

        <SectionLabel>Documents</SectionLabel>
        <DocRow filename="Export Packing List 1.pdf" onOpen={() => undefined} />
        <DocRow filename="spec-sheet.xlsx" />
        <DocRow filename="VOIZZ DOCUMENTATION.docx" onRemove={() => undefined} />

        <SectionLabel>Negotiation</SectionLabel>
        <Bubble who="eco" round="Request" headline="15,000 pcs @ AED 10,000" note="let's make it" time="28 Jun at 6:48 PM" />
        <Bubble who="You" round="Counter 1" headline="AED 11,000 · 15,500 pcs" note="fix it" time="28 Jun at 8:46 PM" mine />

        <SectionLabel>Steps</SectionLabel>
        <Steps total={3} current={2} />

        <SectionLabel>Toggle</SectionLabel>
        <Card>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Push notifications</Text>
            <Toggle value={push} onChange={setPush} />
          </View>
        </Card>

        <SectionLabel>Overlays</SectionLabel>
        <View style={styles.rowGap}>
          <Button label="Open sheet" variant="ghost" onPress={() => setSheet(true)} style={styles.flex} />
          <Button label="Open popover" variant="ghost" onPress={() => setPop(true)} style={styles.flex} />
        </View>

        <SectionLabel>Empty state</SectionLabel>
        <EmptyState icon="bell" title="You're all caught up" message="Unread notifications will appear here." />

        <SectionLabel>WhatsApp logo</SectionLabel>
        <View style={styles.rowGap}>
          <GlassPanel radius={16} style={styles.waCell}>
            <WhatsAppLogo size={28} variant="color" />
            <Text style={styles.help}>color — light surfaces</Text>
          </GlassPanel>
          <View style={[styles.waCell, styles.waGreen]}>
            <WhatsAppLogo size={28} variant="glyph" />
            <Text style={styles.waGreenText}>glyph — green button</Text>
          </View>
        </View>

        <SectionLabel>Icons</SectionLabel>
        <View style={styles.wrap}>
          {ALL_ICONS.map((n) => (
            <GlassPanel key={n} radius={14} style={styles.iconCell}>
              <Icon name={n} size={22} color={colors.navy} />
              <Text style={styles.iconName}>{n}</Text>
            </GlassPanel>
          ))}
        </View>

        <SectionLabel>Gradients</SectionLabel>
        <View style={styles.wrap}>
          {(Object.keys(gradients) as Array<keyof typeof gradients>).map((g) => (
            <Thumb key={g} name={g} size={56} gradient={g} />
          ))}
        </View>
      </ScrollView>

      <FabSpeedDial
        actions={[
          { key: 'manual', label: 'Add manually', icon: 'user', onPress: () => undefined },
          { key: 'import', label: 'Import contacts', icon: 'import', onPress: () => undefined },
        ]}
      />

      <TabBar
        tabs={[
          { key: 'home', label: 'Home', icon: 'home', flex: 0.78 },
          { key: 'inventory', label: 'My inventory', icon: 'box', flex: 1.08 },
          { key: 'received', label: 'Received', icon: 'inbox', flex: 0.88, badge: 1 },
          { key: 'reserve', label: 'Reservation Hub', icon: 'cal', flex: 1.26, badge: 2 },
        ]}
        value={tab}
        onChange={setTab}
      />

      <Popover open={pop} onClose={() => setPop(false)}>
        <SheetAction icon="user" label="Business profile" onPress={() => setPop(false)} />
        <SheetAction icon="gear" label="Settings" onPress={() => setPop(false)} />
        <SheetAction icon="off" label="Log out" danger last onPress={() => setPop(false)} />
      </Popover>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Reserve quantity"
        description="Reserve directly here — no need to call."
      >
        <Text style={styles.label}>Quantity (unit) *</Text>
        <QtyStepper value={qty} onChange={setQty} step={100} max={50000} />
        <View style={styles.gap} />
        <TextField label="Your offered price (AED per unit)" placeholder="AED 840/unit (listed price)" />
        <Button label="Request reservation" variant="green" onPress={() => setSheet(false)} />
        <View style={styles.gap} />
        <Button label="Cancel" variant="ghost" onPress={() => setSheet(false)} />
      </Sheet>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter },
  stack: { gap: 10 },
  rowGap: { flexDirection: 'row', gap: 11 },
  flex: { flex: 1 },
  gap: { height: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  help: { fontSize: 12.5, color: colors.muted, fontWeight: '600', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '800', color: colors.navy },
  ladder: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  ladderText: { fontSize: 14, fontWeight: '800', color: colors.navy },
  ladderVal: { fontSize: 11.5, color: colors.muted, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: colors.navy },
  iconCell: { width: 74, height: 62, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconName: { fontSize: 9, color: colors.muted, fontWeight: '700' },
  waCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  waGreen: { backgroundColor: colors.green, borderRadius: 16 },
  waGreenText: { fontSize: 12.5, color: '#FFFFFF', fontWeight: '700' },
});
