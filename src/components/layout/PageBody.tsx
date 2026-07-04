import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

import { colors } from '../../theme/tokens';
import { useIsMobile } from '../../hooks/useIsMobile';

type PageBodyProps = {
  children: ReactNode;
  /** Extra style for the scroll content container (e.g. to override padding). */
  contentContainerStyle?: ViewStyle;
};

/**
 * Scrolling content region below the page header (mirror `.pb`).
 * flex:1 so it fills the remaining height; vertical scroll. On mobile the
 * padding tightens and the bottom is padded so content clears the floating
 * footer nav.
 */
export function PageBody({
  children,
  contentContainerStyle,
}: PageBodyProps): React.JSX.Element {
  const isMobile = useIsMobile();
  return (
    <KeyboardAvoidingView
      style={styles.body}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.body}
        contentContainerStyle={[isMobile ? styles.contentMobile : styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // `.pb`
  body: { flex: 1, backgroundColor: colors.bgPage },
  content: { paddingHorizontal: 28, paddingVertical: 24 },
  // Tighter sides + extra bottom so the floating footer nav doesn't cover content.
  contentMobile: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
});
