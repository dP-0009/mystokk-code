import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { BRAND } from '../constants/brand';
import { BrandWordmark } from '../components/shared/BrandWordmark';
import { LiveInventoryIcon, PrivateNetworkIcon } from '../components/branding/WelcomeChipIcons';
import { Button, Icon, ScreenBackground, colors, spacing } from '../components/mobile';

const LOGO = require('../../assets/branding/mystokk-logo.png');

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

const FEATURES: ReadonlyArray<{ key: string; label: string; render: () => React.JSX.Element }> = [
  { key: 'private', label: 'Private\nNetwork', render: () => <PrivateNetworkIcon size={24} /> },
  { key: 'live', label: 'Live\nInventory', render: () => <LiveInventoryIcon size={24} /> },
  { key: 'sharing', label: 'Instant\nSharing', render: () => <Icon name="share" size={24} color={BRAND.primary} /> },
];

/**
 * Welcome — NATIVE VARIANT (prototype SCREENS.welcome).
 *
 * THIS IS THE ROOT ROUTING FORK. `Landing` is the first screen in
 * RootNavigator's signed-out group, i.e. the entry route for an unauthenticated
 * user, so replacing it here is the whole fix: the web marketing page can never
 * render on a phone, and no navigator file is touched.
 */
export function LandingScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 54 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {/* Brand mark — the logo stands alone (no tile). */}
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />

          <BrandWordmark size={38} style={styles.wordmark} />
          <Text style={styles.subtitle}>Private B2B inventory sharing</Text>

          {/* Three feature chips */}
          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.key} style={styles.feature}>
                <View style={styles.featureIcon}>{f.render()}</View>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Button label="Log in" variant="primary" onPress={() => navigation.navigate('Login')} />
          <Button
            label="Create free account"
            variant="ghost"
            onPress={() => navigation.navigate('Signup')}
          />
          <Text style={styles.noCard}>No Credit Card Required</Text>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 26 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 104,
    height: 104,
  },
  wordmark: { marginTop: 24 },
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 10,
  },
  features: { flexDirection: 'row', gap: 22, marginTop: 34 },
  feature: { alignItems: 'center' },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: 'rgba(46,124,246,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  featureLabel: { fontSize: 12, fontWeight: '800', color: colors.navy, textAlign: 'center', lineHeight: 15 },
  actions: { gap: 11, marginTop: spacing.xxl },
  noCard: { fontSize: 13, color: BRAND.mutedText, textAlign: 'center', marginTop: 12 },
});
