import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { AppButton } from '../components/shared/AppButton';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

const FEATURES: ReadonlyArray<{ icon: string; bold: string; rest: string }> = [
  { icon: '🔒', bold: 'Private by design', rest: ' — share live stock only with vendors you choose, never a public marketplace' },
  { icon: '🔗', bold: 'Chained sharing', rest: ' — forward offers downstream without ever exposing the original supplier or price' },
  { icon: '🤝', bold: 'Built-in negotiation', rest: ' — up to 3 rounds of counter-offers before confirming a reservation' },
];

export function LandingScreen({ navigation }: Props): React.JSX.Element {
  return (
    <LinearGradient
      colors={[colors.navy, colors.navyDeep, colors.navy]}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      <SafeAreaView style={styles.fill}>
        <View style={styles.content}>
          <Text style={styles.logo}>
            My<Text style={styles.logoAccent}>Stokk</Text>
          </Text>
          <Text style={styles.tag}>
            Private B2B inventory sharing.{'\n'}Your stock. Your trusted network. Your terms.
          </Text>

          {FEATURES.map((f) => (
            <View key={f.bold} style={styles.feature}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>
                <Text style={styles.featureBold}>{f.bold}</Text>
                {f.rest}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <AppButton title="Create Account" variant="emerald" onPress={() => navigation.navigate('Signup')} />
          <View style={styles.gap} />
          <AppButton title="Log In" variant="translucent" onPress={() => navigation.navigate('Login')} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 38, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginBottom: 4 },
  logoAccent: { color: colors.emeraldLight },
  tag: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 36, lineHeight: 21 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  featureIcon: { fontSize: 22 },
  featureText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 21 },
  featureBold: { fontWeight: '700', color: '#FFFFFF' },
  actions: { paddingHorizontal: 32, paddingBottom: 16 },
  gap: { height: 12 },
});
