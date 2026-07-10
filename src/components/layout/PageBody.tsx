import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/tokens';
import { useIsMobile } from '../../hooks/useIsMobile';
import { MOBILE_TAB_BAR_HEIGHT } from './MobileTabBar';

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
  const insets = useSafeAreaInsets();
  // The footer nav floats over this ScrollView, so reserve its real height plus
  // the device's bottom inset (gesture bar / home indicator). A fixed number was
  // too small on Android, hiding the last row of every screen behind the bar.
  const mobileBottomPad = { paddingBottom: MOBILE_TAB_BAR_HEIGHT + insets.bottom + 16 };
  return (
    <KeyboardAvoidingView
      style={styles.body}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          isMobile ? [styles.contentMobile, mobileBottomPad] : styles.content,
          contentContainerStyle,
        ]}
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
  // Tighter sides; the bottom pad is computed from the footer nav's real height.
  contentMobile: { paddingHorizontal: 16, paddingTop: 16 },
});
