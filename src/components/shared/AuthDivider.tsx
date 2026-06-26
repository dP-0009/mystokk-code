import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/tokens';

/** Horizontal "OR" divider used between the primary action and Google sign-in. */
export function AuthDivider(): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.text}>OR</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: colors.slate200 },
  text: { marginHorizontal: 12, fontSize: 12, fontWeight: '700', color: colors.slate400 },
});
