import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { Button, Card, Icon, NavBar, ScreenBackground, colors, layout, spacing } from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;

type Block = { h?: string; p: string };

const TITLES: Record<Props['route']['params']['page'], string> = {
  faq: 'FAQ',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  contact: 'Contact',
};

/** Prose content, verbatim from the prototype (SCREENS.faq/privacy/terms). */
const CONTENT: Record<'faq' | 'privacy' | 'terms', Block[]> = {
  faq: [
    { h: 'What is MyStokk?', p: 'MyStokk is a private B2B platform for trading and distribution businesses to share live stock, reserve and negotiate inventory, and pass offers along to trusted contacts — never to the open market.' },
    { h: 'Who can see my inventory?', p: 'Only the vendors you explicitly share an item with, or anyone you send a public share link to. Your catalog is never publicly listed or searchable.' },
    { h: 'How do reservations and negotiation work?', p: 'A buyer reserves a quantity at your listed or an offered price. From there each side can counter, accept, or reject. Negotiation is capped at 3 rounds per side, and the full history is kept on the reservation.' },
    { h: 'What happens when I share a received item?', p: "Your contact sees the item with your price and remark. The original supplier's identity and price are never revealed — that's the MyStokk privacy chain." },
  ],
  privacy: [
    { p: 'Your privacy matters. This policy explains what we collect and how we use it. By using MyStokk you agree to the practices described here.' },
    { h: 'Information we collect', p: 'Account details (company name, contact person, email), the inventory and documents you upload, your network connections, and reservation/negotiation activity. We also collect basic usage and device information to operate the service.' },
    { h: 'How we use it', p: 'To provide the platform: showing your inventory to the contacts you choose, delivering share and reservation notifications, and keeping your account secure. We do not sell your data, and we never list your inventory on a public marketplace.' },
  ],
  terms: [
    { p: 'These terms govern your use of MyStokk. By creating an account you agree to them.' },
    { h: 'Using the service', p: 'You must provide accurate company information and are responsible for activity under your account. Use MyStokk only for legitimate B2B trading and distribution purposes.' },
    { h: 'Your content', p: 'You retain ownership of the inventory, photos, and documents you upload. You grant MyStokk the rights needed to display that content to the contacts you share it with and to operate the service.' },
    { h: 'Reservations & negotiations', p: 'Reservations and counter-offers made on the platform reflect commercial intent between businesses; each party is responsible for fulfilment, payment, and disputes.' },
  ],
};

/** Legal + Contact (prototype SCREENS.faq/privacy/terms/contact). */
export function LegalScreen({ navigation, route }: Props): React.JSX.Element {
  const { page } = route.params;
  const insets = useSafeAreaInsets();

  return (
    <ScreenBackground>
      <NavBar title={TITLES[page]} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {page === 'contact' ? (
          <>
            <Text style={styles.h1}>We&apos;re here to help</Text>
            <Text style={styles.sub}>Questions, feedback, or need a hand getting set up?</Text>
            <Card style={styles.card}>
              <Text style={styles.h4}>Support</Text>
              <Text style={styles.p}>For account help, bugs, or general questions, email us using the button below.</Text>
              <Text style={styles.h4}>Business hours</Text>
              <Text style={styles.pLast}>We typically respond within one business day, Sunday–Thursday.</Text>
            </Card>
            <Button
              label="Email support@mystokk.app"
              variant="dark"
              icon={<Icon name="mail" size={19} color="#FFFFFF" />}
              onPress={() => Linking.openURL('mailto:support@mystokk.app')}
              style={styles.contactBtn}
            />
          </>
        ) : (
          <View style={styles.prose}>
            {CONTENT[page].map((b, i) => (
              <View key={i}>
                {b.h ? <Text style={styles.h4}>{b.h}</Text> : null}
                <Text style={styles.p}>{b.p}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter },
  prose: { paddingTop: 4 },
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.navy, marginTop: 2 },
  sub: { fontSize: 14.5, color: colors.muted, marginTop: 3, marginBottom: 18 },
  card: { padding: 16 },
  h4: { fontSize: 15.5, fontWeight: '800', color: colors.navy, marginTop: 16, marginBottom: 6 },
  p: { fontSize: 14.5, lineHeight: 23, color: colors.text, marginBottom: 10 },
  pLast: { fontSize: 14.5, lineHeight: 23, color: colors.text },
  contactBtn: { marginTop: 16 },
});
