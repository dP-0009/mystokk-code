import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from './theme';

export type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'gray';

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  green: { bg: colors.greenBg, fg: colors.green },
  amber: { bg: colors.amberBg, fg: colors.amber },
  red: { bg: colors.redBg, fg: colors.red },
  blue: { bg: colors.ice, fg: colors.blueDark },
  gray: { bg: colors.grayBg, fg: colors.muted },
};

export function Badge({ label, tone = 'gray' }: { label: string; tone?: BadgeTone }): React.JSX.Element {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[typography.badge, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Domain statuses → tone, mirroring the prototype's stBadge(). */
const STATUS_TONE: Record<string, BadgeTone> = {
  Active: 'green',
  'Partially Reserved': 'amber',
  'Sold Out': 'red',
  Pending: 'amber',
  Confirmed: 'green',
  Rejected: 'red',
  Cancelled: 'gray',
  Connected: 'green',
  Manual: 'blue',
  New: 'blue',
};

export function StatusBadge({ status }: { status: string }): React.JSX.Element {
  return <Badge label={status} tone={STATUS_TONE[status] ?? 'gray'} />;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3.5,
    paddingHorizontal: 9,
    borderRadius: 9,
  },
});
