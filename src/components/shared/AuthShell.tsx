import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, shadows } from '../../theme/tokens';
import { webOnly } from '../layout/web';
import { BrandMark } from './BrandMark';
import { Reveal } from './Reveal';

interface AuthShellProps {
  title: string;
  /** Plain text, or rich nodes when part of it needs emphasis (e.g. an email). */
  subtitle: ReactNode;
  onBack: () => void;
  /** Form body. */
  children: ReactNode;
  /** Below-card row (e.g. "Already have an account? Log in"). */
  footer?: ReactNode;
}

/**
 * Shared chrome for the Login / Signup screens. A light page with a slim top
 * bar (brand lockup + back), and a centered white card that animates in. On web
 * the card is capped to a comfortable reading width and sits in the middle of
 * the viewport; on native it fills the column. Matches the app shell's tokens
 * (light surfaces, blue accent, navy text).
 */
export function AuthShell({
  title,
  subtitle,
  onBack,
  children,
  footer,
}: AuthShellProps): React.JSX.Element {
  return (
    <View style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        {/* Top bar */}
        <View style={styles.topbar}>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={[styles.back, webOnly({ cursor: 'pointer' })]}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <BrandMark size={30} labelSize={16} />
          {/* Spacer to balance the back button so the brand stays centred. */}
          <View style={styles.backSpacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Reveal style={styles.cardWrap} offsetY={28}>
              <View style={styles.card}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
                {children}
              </View>
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </Reveal>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bgPage },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgWhite,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 72 },
  backText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  backSpacer: { width: 72 },

  scrollBody: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  cardWrap: { width: '100%', maxWidth: 440 },
  card: {
    backgroundColor: colors.bgWhite,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    ...shadows.md,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.4, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 24 },
  // `alignSelf: stretch` + a full-width child: without it the footer Text is
  // sized to its max-content and Android clips the tail ("…Sign" instead of
  // "…Sign up") rather than wrapping.
  footer: { marginTop: 20, alignItems: 'center', alignSelf: 'stretch', width: '100%' },
});
