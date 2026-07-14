import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { Button, Icon, ScreenBackground, colors, gradients, spacing, type IconName } from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

const FEATURES: ReadonlyArray<{ icon: IconName; label: string }> = [
  { icon: 'lock', label: 'Private' },
  { icon: 'clock', label: 'Live stock' },
  { icon: 'hand', label: 'Negotiate' },
];

/**
 * Welcome — NATIVE VARIANT (prototype SCREENS.welcome).
 *
 * THIS IS THE ROOT ROUTING FORK. `Landing` is the first screen in
 * RootNavigator's signed-out group, i.e. the entry route for an unauthenticated
 * user, so replacing it here is the whole fix: the web marketing page can never
 * render on a phone, and no navigator file is touched.
 *
 * The session case needs no code and no new auth logic: RootNavigator already
 * gates on the existing auth store — `signedIn` renders the Main tabs and this
 * screen never mounts. Reaching here *means* signed out.
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
          {/* Logo tile */}
          <LinearGradient
            colors={[...gradients.blue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Icon name="box" size={52} color="#FFFFFF" />
          </LinearGradient>

          <Text style={styles.wordmark}>MyStokk</Text>
          <Text style={styles.tagline}>
            Your stock. Your trusted network. Your terms.{'\n'}Private B2B inventory sharing.
          </Text>

          {/* Three feature chips */}
          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Icon name={f.icon} size={24} color={colors.blue} />
                </View>
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
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 26 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 98,
    height: 98,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.blue,
    shadowOpacity: 0.4,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 22 },
    elevation: 12,
  },
  wordmark: { fontSize: 36, fontWeight: '800', letterSpacing: -1.2, color: colors.navy, marginTop: 24 },
  tagline: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 25,
    maxWidth: 290,
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
  featureLabel: { fontSize: 12, fontWeight: '800', color: colors.navy },
  actions: { gap: 11, marginTop: spacing.xxl },
});
