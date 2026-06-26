import React, { type ReactNode } from 'react';
import { ScrollView, StyleSheet, type ViewStyle } from 'react-native';

import { colors } from '../../theme/tokens';

type PageBodyProps = {
  children: ReactNode;
  /** Extra style for the scroll content container (e.g. to override padding). */
  contentContainerStyle?: ViewStyle;
};

/**
 * Scrolling content region below the page header (mirror `.pb`).
 * flex:1 so it fills the remaining height; 24x28 padding; vertical scroll.
 */
export function PageBody({
  children,
  contentContainerStyle,
}: PageBodyProps): React.JSX.Element {
  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={[styles.content, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // `.pb`
  body: { flex: 1, backgroundColor: colors.bgPage },
  content: { paddingHorizontal: 28, paddingVertical: 24 },
});
