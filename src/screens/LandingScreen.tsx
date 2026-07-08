import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { BrandMark } from '../components/shared/BrandMark';
import { Reveal } from '../components/shared/Reveal';
import { useIsMobile } from '../hooks/useIsMobile';
import { webOnly } from '../components/layout/web';
import { colors, radius, shadows } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const FEATURES: ReadonlyArray<{ icon: IoniconName; tint: string; bg: string; title: string; body: string }> = [
  {
    icon: 'lock-closed',
    tint: colors.accent,
    bg: colors.accentLight,
    title: 'Private by design',
    body: 'Share live stock only with vendors you choose — never a public marketplace.',
  },
  {
    icon: 'git-network',
    tint: colors.purple,
    bg: colors.purpleLight,
    title: 'Chained sharing',
    body: 'Forward offers downstream without ever exposing the original supplier or price.',
  },
  {
    icon: 'chatbubbles',
    tint: colors.green,
    bg: colors.greenLight,
    title: 'Built-in negotiation',
    body: 'Up to three rounds of counter-offers before confirming a reservation.',
  },
];

const STEPS: ReadonlyArray<{ n: string; title: string; body: string }> = [
  { n: '1', title: 'List your stock', body: 'Add inventory with photos, pricing and quantities in seconds.' },
  { n: '2', title: 'Share privately', body: 'Send live availability to the exact vendors in your network.' },
  { n: '3', title: 'Reserve & negotiate', body: 'Counter-offers, reservations and forwarding — all in one place.' },
];

/** A softly drifting blurred blob that gives the hero ambient motion. */
function FloatingOrb({
  color,
  size,
  delay,
  style,
}: {
  color: string;
  size: number;
  delay: number;
  style: object;
}): React.JSX.Element {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 4200,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, delay]);

  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -26] });
  const scale = drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
        { transform: [{ translateY }, { scale }] },
      ]}
    />
  );
}

export function LandingScreen({ navigation }: Props): React.JSX.Element {
  const isMobile = useIsMobile();

  const goSignup = (): void => navigation.navigate('Signup');
  const goLogin = (): void => navigation.navigate('Login');

  return (
    <View style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        {/* Top navigation bar */}
        <View style={styles.topbar}>
          <View style={styles.topbarInner}>
            <BrandMark size={32} labelSize={18} />
            <View style={styles.topActions}>
              <Pressable onPress={goLogin} style={[styles.navGhost, webOnly({ cursor: 'pointer' })]}>
                <Text style={styles.navGhostText}>Log In</Text>
              </Pressable>
              <Pressable onPress={goSignup} style={[styles.navCta, webOnly({ cursor: 'pointer' })]}>
                <Text style={styles.navCtaText}>Sign Up</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
          {/* ---------------- Hero ---------------- */}
          <View style={styles.hero}>
            {/* Ambient motion behind the hero copy */}
            <FloatingOrb color="rgba(37,99,235,0.10)" size={260} delay={0} style={{ top: -40, left: -60 }} />
            <FloatingOrb color="rgba(124,58,237,0.10)" size={200} delay={900} style={{ top: 20, right: -40 }} />
            <FloatingOrb color="rgba(22,163,74,0.08)" size={160} delay={1800} style={{ bottom: -30, left: '40%' }} />

            <View style={[styles.heroInner, isMobile ? styles.heroInnerMobile : null]}>
              <Reveal delay={60}>
                <View style={styles.eyebrow}>
                  <View style={styles.eyebrowDot} />
                  <Text style={styles.eyebrowText}>Private B2B inventory sharing</Text>
                </View>
              </Reveal>

              <Reveal delay={140}>
                <Text style={[styles.h1, isMobile ? styles.h1Mobile : null]}>
                  Share live stock with the{'\n'}
                  <Text style={styles.h1Accent}>vendors you trust</Text>.
                </Text>
              </Reveal>

              <Reveal delay={220}>
                <Text style={[styles.heroSub, isMobile ? styles.heroSubMobile : null]}>
                  Your stock. Your trusted network. Your terms. MyStokk keeps your inventory
                  private — no public marketplace, no leaked suppliers.
                </Text>
              </Reveal>

              <Reveal delay={300}>
                <View style={[styles.ctaRow, isMobile ? styles.ctaRowMobile : null]}>
                  <Pressable
                    onPress={goSignup}
                    style={[styles.primaryBtn, isMobile ? styles.btnBlock : null, webOnly({ cursor: 'pointer' })]}
                  >
                    <Text style={styles.primaryBtnText}>Create free account</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    onPress={goLogin}
                    style={[styles.secondaryBtn, isMobile ? styles.btnBlock : null, webOnly({ cursor: 'pointer' })]}
                  >
                    <Text style={styles.secondaryBtnText}>Log In</Text>
                  </Pressable>
                </View>
              </Reveal>
            </View>
          </View>

          {/* ---------------- Features ---------------- */}
          <View style={styles.section}>
            <View style={[styles.cardGrid, isMobile ? styles.cardGridMobile : null]}>
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={120 + i * 120} style={isMobile ? styles.cardFull : styles.cardFlex}>
                  <View style={styles.featureCard}>
                    <View style={[styles.featureIcon, { backgroundColor: f.bg }]}>
                      <Ionicons name={f.icon} size={22} color={f.tint} />
                    </View>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.featureBody}>{f.body}</Text>
                  </View>
                </Reveal>
              ))}
            </View>
          </View>

          {/* ---------------- How it works ---------------- */}
          <View style={styles.section}>
            <Reveal delay={80}>
              <Text style={styles.sectionEyebrow}>HOW IT WORKS</Text>
              <Text style={styles.sectionTitle}>From listing to reservation in three steps</Text>
            </Reveal>
            <View style={[styles.stepsRow, isMobile ? styles.stepsRowMobile : null]}>
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={160 + i * 120} style={isMobile ? styles.cardFull : styles.cardFlex}>
                  <View style={styles.stepCard}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{s.n}</Text>
                    </View>
                    <Text style={styles.featureTitle}>{s.title}</Text>
                    <Text style={styles.featureBody}>{s.body}</Text>
                  </View>
                </Reveal>
              ))}
            </View>
          </View>

          {/* ---------------- Closing CTA ---------------- */}
          <View style={styles.section}>
            <Reveal delay={80}>
              <View style={styles.ctaBand}>
                <FloatingOrb color="rgba(255,255,255,0.06)" size={220} delay={400} style={{ top: -60, right: -40 }} />
                <Text style={styles.ctaBandTitle}>Ready to take control of your stock?</Text>
                <Text style={styles.ctaBandSub}>
                  Join the trading and distribution businesses sharing smarter on MyStokk.
                </Text>
                <Pressable onPress={goSignup} style={[styles.ctaBandBtn, webOnly({ cursor: 'pointer' })]}>
                  <Text style={styles.ctaBandBtnText}>Get started — it&apos;s free</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.accent} />
                </Pressable>
              </View>
            </Reveal>
          </View>

          {/* ---------------- Footer ---------------- */}
          <View style={styles.footer}>
            <BrandMark size={26} labelSize={15} />
            <View style={styles.footerLinks}>
              <FooterLink label="Privacy Policy" onPress={() => navigation.navigate('Legal', { page: 'privacy' })} />
              <Text style={styles.footerDot}>·</Text>
              <FooterLink label="Terms of Service" onPress={() => navigation.navigate('Legal', { page: 'terms' })} />
              <Text style={styles.footerDot}>·</Text>
              <FooterLink label="Contact Us" onPress={() => navigation.navigate('Legal', { page: 'contact' })} />
              <Text style={styles.footerDot}>·</Text>
              <FooterLink label="FAQ" onPress={() => navigation.navigate('Legal', { page: 'faq' })} />
            </View>
            <Text style={styles.footerCopy}>
              © {new Date().getFullYear()} Everglobal Trading LLC · MyStokk. Private B2B inventory sharing.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** A muted, hover-underlined footer link. */
function FooterLink({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={webOnly({ cursor: 'pointer' })}>
      <Text style={styles.footerLink}>{label}</Text>
    </Pressable>
  );
}

const MAXW = 1080;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bgPage },

  // Top bar
  topbar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgWhite,
    ...webOnly({ position: 'sticky', top: 0, zIndex: 10 }),
  },
  topbarInner: {
    width: '100%',
    maxWidth: MAXW,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navGhost: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md },
  navGhostText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  navCta: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.accent },
  navCtaText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  scrollBody: { paddingBottom: 8 },

  // Hero
  hero: { overflow: 'hidden', paddingTop: 56, paddingBottom: 64, paddingHorizontal: 20 },
  heroInner: { width: '100%', maxWidth: 760, alignSelf: 'center', alignItems: 'center' },
  heroInnerMobile: { paddingTop: 8 },
  orb: { position: 'absolute', ...webOnly({ filter: 'blur(8px)' }) },

  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.accentMid,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 20,
  },
  eyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  eyebrowText: { fontSize: 12, fontWeight: '700', color: colors.accent, letterSpacing: 0.2 },

  h1: {
    fontSize: 48,
    lineHeight: 54,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -1.2,
    marginBottom: 18,
  },
  h1Mobile: { fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  h1Accent: { color: colors.accent },

  heroSub: {
    fontSize: 17,
    lineHeight: 26,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 560,
    marginBottom: 30,
  },
  heroSubMobile: { fontSize: 15, lineHeight: 23 },

  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctaRowMobile: { flexDirection: 'column', alignSelf: 'stretch' },
  btnBlock: { alignSelf: 'stretch', justifyContent: 'center' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radius.md,
    ...shadows.md,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgWhite,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  // Sections
  section: { width: '100%', maxWidth: MAXW, alignSelf: 'center', paddingHorizontal: 20, marginTop: 16, marginBottom: 32 },
  sectionEyebrow: { fontSize: 12, fontWeight: '800', color: colors.accent, letterSpacing: 1, textAlign: 'center' },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 24,
  },

  // Cards
  cardGrid: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  cardGridMobile: { flexDirection: 'column' },
  cardFlex: { flex: 1, minWidth: 240 },
  cardFull: { width: '100%' },

  featureCard: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 24,
    height: '100%',
    ...shadows.sm,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  featureTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  featureBody: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },

  // Steps
  stepsRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  stepsRowMobile: { flexDirection: 'column' },
  stepCard: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 24,
    height: '100%',
    ...shadows.sm,
  },
  stepNum: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepNumText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },

  // Closing CTA band
  ctaBand: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: 28,
    paddingVertical: 40,
    alignItems: 'center',
    overflow: 'hidden',
  },
  ctaBandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  ctaBandSub: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    maxWidth: 480,
    marginBottom: 22,
  },
  ctaBandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  ctaBandBtnText: { fontSize: 15, fontWeight: '700', color: colors.accent },

  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgWhite,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
  },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  footerLink: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  footerDot: { fontSize: 13, color: colors.textMuted },
  footerCopy: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
