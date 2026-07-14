import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors } from './theme';

export interface Segment {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

/** iOS-style segmented control (.seg) — e.g. Received (4) / Sent (2). */
export function SegmentedControl({
  segments,
  value,
  onChange,
}: {
  segments: Segment[];
  value: string;
  onChange: (key: string) => void;
}): React.JSX.Element {
  return (
    <View style={styles.track}>
      {segments.map((s) => {
        const on = s.key === value;
        return (
          <Pressable
            key={s.key}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(s.key);
            }}
            style={[styles.seg, on && styles.segOn]}
          >
            {s.icon}
            <Text style={[styles.label, on ? styles.labelOn : styles.labelOff]}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Underline tabs (.utab) with a count pill — Network / Pending. */
export function UnderlineTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: string; label: string; count?: number }>;
  value: string;
  onChange: (key: string) => void;
}): React.JSX.Element {
  return (
    <View style={styles.utabBar}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(t.key);
            }}
            style={[styles.utab, on && styles.utabOn]}
          >
            <Text style={[styles.utabLabel, on && styles.utabLabelOn]}>{t.label}</Text>
            {t.count !== undefined ? (
              <View style={[styles.ucount, on && styles.ucountOn]}>
                <Text style={[styles.ucountText, on && styles.ucountTextOn]}>{t.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: 'rgba(233,237,245,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(15,43,84,0.08)',
    borderRadius: 16,
    padding: 3,
    marginVertical: 12,
  },
  seg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9.5,
    borderRadius: 13,
  },
  segOn: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    shadowColor: colors.navy,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  label: { fontSize: 13.5, fontWeight: '800' },
  labelOff: { color: colors.muted },
  labelOn: { color: colors.navy },

  utabBar: {
    flexDirection: 'row',
    gap: 26,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.line,
    marginTop: 16,
  },
  utab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginBottom: -1.5,
  },
  utabOn: { borderBottomColor: colors.blue },
  utabLabel: { fontSize: 15, fontWeight: '800', color: colors.muted },
  utabLabelOn: { color: colors.blue },
  ucount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: 'rgba(15,43,84,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ucountOn: { backgroundColor: 'rgba(46,124,246,0.18)' },
  ucountText: { fontSize: 12, fontWeight: '800', color: colors.navy },
  ucountTextOn: { color: colors.blueDark },
});
