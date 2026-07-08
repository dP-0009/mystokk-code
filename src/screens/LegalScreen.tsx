import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { webOnly } from '../components/layout/web';
import { BrandMark } from '../components/shared/BrandMark';
import { LegalContent, LEGAL_PAGES } from '../components/shared/LegalContent';
import { useAuthStore } from '../stores/authStore';
import { colors, radius } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;

export function LegalScreen({ navigation, route }: Props): React.JSX.Element {
  const page = route.params?.page ?? 'faq';
  const content = LEGAL_PAGES[page];
  const signedIn = useAuthStore((s) => s.status === 'signedIn');

  // Public visitors (reached at /privacy, /terms, … while signed out) get a
  // standalone page with a simple top bar — never the signed-in app shell.
  if (!signedIn) {
    return (
      <View style={styles.publicFill}>
        <SafeAreaView style={styles.publicFill} edges={['top']}>
          <View style={styles.topbar}>
            <View style={styles.topbarInner}>
              <Pressable onPress={() => navigation.navigate('Landing')} style={webOnly({ cursor: 'pointer' })}>
                <BrandMark size={30} labelSize={17} />
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Login')}
                style={[styles.navCta, webOnly({ cursor: 'pointer' })]}
              >
                <Text style={styles.navCtaText}>Log In</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.publicScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.publicWrap}>
              <Text style={styles.publicTitle}>{content.title}</Text>
              <Text style={styles.publicSubtitle}>{content.subtitle}</Text>
              <LegalContent page={page} />
              <View style={styles.publicFooter}>
                <Pressable onPress={() => navigation.navigate('Legal', { page: 'privacy' })}>
                  <Text style={styles.publicFooterLink}>Privacy</Text>
                </Pressable>
                <Text style={styles.publicFooterDot}>·</Text>
                <Pressable onPress={() => navigation.navigate('Legal', { page: 'terms' })}>
                  <Text style={styles.publicFooterLink}>Terms</Text>
                </Pressable>
                <Text style={styles.publicFooterDot}>·</Text>
                <Pressable onPress={() => navigation.navigate('Legal', { page: 'contact' })}>
                  <Text style={styles.publicFooterLink}>Contact</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <MainLayout active={page}>
      <PageHeader
        title={content.title}
        subtitle={content.subtitle}
        leading={<BackLink onPress={() => navigation.goBack()} />}
      />
      <PageBody>
        <View style={styles.wrap}>
          <LegalContent page={page} />
        </View>
      </PageBody>
    </MainLayout>
  );
}

function BackLink({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[styles.backLink, webOnly({ cursor: 'pointer' })]}>
      <Text style={styles.backText}>← Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  backLink: { marginBottom: 8 },
  backText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  // Public (signed-out) standalone layout
  publicFill: { flex: 1, backgroundColor: colors.bgPage },
  topbar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgWhite,
    ...webOnly({ position: 'sticky', top: 0, zIndex: 10 }),
  },
  topbarInner: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navCta: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.accent },
  navCtaText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  publicScroll: { paddingVertical: 32, paddingHorizontal: 20 },
  publicWrap: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  publicTitle: { fontSize: 30, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.6, marginBottom: 6 },
  publicSubtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: 22 },
  publicFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 28 },
  publicFooterLink: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  publicFooterDot: { fontSize: 13, color: colors.textMuted },
});
