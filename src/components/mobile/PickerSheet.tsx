import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GlassPanel } from './GlassPanel';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { colors, glass, radii } from './theme';

/**
 * Option list in a bottom sheet — the native stand-in for the prototype's
 * <select> dropdowns (industry, country, dial code). Optionally searchable,
 * matching DropdownSelectField's `searchable` behaviour on web.
 */
export function PickerSheet({
  open,
  onClose,
  title,
  options,
  value,
  onSelect,
  searchable = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: readonly string[];
  value?: string;
  onSelect: (option: string) => void;
  searchable?: boolean;
}): React.JSX.Element {
  const [query, setQuery] = React.useState('');

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const choose = (option: string): void => {
    setQuery('');
    onSelect(option);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {searchable ? (
        <GlassPanel effect="clear" radius={radii.input} fill={glass.fillInput} style={styles.search}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search…"
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            autoCorrect={false}
          />
        </GlassPanel>
      ) : null}

      {filtered.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => choose(option)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View style={styles.row}>
              <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>
                {option}
              </Text>
              {selected ? <Icon name="check" size={18} color={colors.blue} /> : null}
            </View>
          </Pressable>
        );
      })}

      {filtered.length === 0 ? <Text style={styles.empty}>No matches.</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 45, paddingHorizontal: 14, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  label: { flex: 1, fontSize: 15.5, fontWeight: '700', color: colors.navy },
  labelOn: { color: colors.blue },
  empty: { paddingVertical: 24, textAlign: 'center', color: colors.muted, fontSize: 14 },
  pressed: { opacity: 0.55 },
});
