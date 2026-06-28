import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { webOnly } from '../components/layout/web';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;

const SUPPORT_EMAIL = 'support@mystokk.app';

type Block =
  | { kind: 'h'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'q'; q: string; a: string };

type PageContent = {
  title: string;
  subtitle: string;
  blocks: Block[];
  /** Show the contact email button at the end. */
  contact?: boolean;
};

const PAGES: Record<RootStackParamList['Legal']['page'], PageContent> = {
  faq: {
    title: 'FAQ',
    subtitle: 'Answers to common questions about MyStokk',
    blocks: [
      {
        kind: 'q',
        q: 'What is MyStokk?',
        a: 'MyStokk is a private B2B platform for trading and distribution businesses to share live stock, reserve and negotiate inventory, and forward offers to trusted contacts — never to the open market.',
      },
      {
        kind: 'q',
        q: 'Who can see my inventory?',
        a: 'Only the vendors you explicitly share an item with, or anyone you send a public share link to. Your catalog is never publicly listed or searchable.',
      },
      {
        kind: 'q',
        q: 'How do reservations and negotiation work?',
        a: 'A buyer reserves a quantity at your listed or an offered price. From there each side can counter, accept, or reject. Negotiation is capped at 3 rounds per side, and the full history is kept on the reservation.',
      },
      {
        kind: 'q',
        q: 'How do I add my network?',
        a: 'Open My Network → Add Vendor to invite a contact by email, or bulk-upload a CSV. Vendors who already have a MyStokk account connect instantly; others receive an invite.',
      },
      {
        kind: 'q',
        q: 'Is my data secure?',
        a: 'Yes. Access is governed by row-level security so vendors only ever see data they are entitled to. Private photos and documents are served through short-lived signed links.',
      },
    ],
    contact: true,
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'How MyStokk collects, uses, and protects your data',
    blocks: [
      { kind: 'p', text: 'Your privacy matters. This policy explains what we collect and how we use it. By using MyStokk you agree to the practices described here.' },
      { kind: 'h', text: 'Information we collect' },
      { kind: 'p', text: 'Account details (company name, contact person, email), the inventory and documents you upload, your network connections, and reservation/negotiation activity. We also collect basic usage and device information to operate the service.' },
      { kind: 'h', text: 'How we use it' },
      { kind: 'p', text: 'To provide the platform: showing your inventory to the contacts you choose, delivering share and reservation notifications, and keeping your account secure. We do not sell your data, and we never list your inventory on a public marketplace.' },
      { kind: 'h', text: 'Sharing' },
      { kind: 'p', text: 'Item details are shared only with the vendors you select or with anyone holding a public share link you created. Notification emails are sent on your behalf via our email provider.' },
      { kind: 'h', text: 'Data security' },
      { kind: 'p', text: 'Access is enforced with row-level security so vendors only see data they are entitled to. Private photos and documents are delivered through short-lived signed URLs.' },
      { kind: 'h', text: 'Your choices' },
      { kind: 'p', text: 'You can edit or delete your inventory and account at any time from Settings. Deleting your account removes your data subject to legal retention requirements.' },
    ],
    contact: true,
  },
  terms: {
    title: 'Terms of Service',
    subtitle: 'The agreement for using MyStokk',
    blocks: [
      { kind: 'p', text: 'These terms govern your use of MyStokk. By creating an account you agree to them.' },
      { kind: 'h', text: 'Using the service' },
      { kind: 'p', text: 'You must provide accurate company information and are responsible for activity under your account. Use MyStokk only for legitimate B2B trading and distribution purposes.' },
      { kind: 'h', text: 'Your content' },
      { kind: 'p', text: 'You retain ownership of the inventory, photos, and documents you upload. You grant MyStokk the rights needed to display that content to the contacts you share it with and to operate the service.' },
      { kind: 'h', text: 'Reservations & negotiations' },
      { kind: 'p', text: 'Reservations and counter-offers made on the platform reflect commercial intent between vendors. MyStokk facilitates the exchange but is not a party to any resulting transaction and is not responsible for fulfilment, payment, or disputes.' },
      { kind: 'h', text: 'Acceptable use' },
      { kind: 'p', text: 'Do not misuse the platform, attempt to access data you are not entitled to, or upload unlawful content. We may suspend accounts that violate these terms.' },
      { kind: 'h', text: 'Changes' },
      { kind: 'p', text: 'We may update these terms as the product evolves. Continued use after an update means you accept the revised terms.' },
    ],
    contact: true,
  },
  contact: {
    title: 'Contact',
    subtitle: 'We’re here to help',
    blocks: [
      { kind: 'p', text: 'Questions, feedback, or need a hand getting set up? Reach the MyStokk team and we’ll get back to you as soon as we can.' },
      { kind: 'h', text: 'Support' },
      { kind: 'p', text: 'For account help, bugs, or general questions, email us using the button below.' },
      { kind: 'h', text: 'Business hours' },
      { kind: 'p', text: 'We typically respond within one business day, Sunday–Thursday.' },
    ],
    contact: true,
  },
};

export function LegalScreen({ navigation, route }: Props): React.JSX.Element {
  const page = route.params?.page ?? 'faq';
  const content = PAGES[page];

  return (
    <MainLayout active={page}>
      <PageHeader
        title={content.title}
        subtitle={content.subtitle}
        leading={<BackLink onPress={() => navigation.goBack()} />}
      />
      <PageBody>
        <View style={styles.wrap}>
          <View style={styles.card}>
            {content.blocks.map((b, i) => {
              if (b.kind === 'h') return <Text key={i} style={styles.heading}>{b.text}</Text>;
              if (b.kind === 'p') return <Text key={i} style={styles.paragraph}>{b.text}</Text>;
              return (
                <View key={i} style={styles.qa}>
                  <Text style={styles.question}>{b.q}</Text>
                  <Text style={styles.answer}>{b.a}</Text>
                </View>
              );
            })}

            {content.contact ? (
              <Pressable
                style={[styles.contactBtn, webOnly({ cursor: 'pointer' })]}
                onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              >
                <Text style={styles.contactBtnText}>Email {SUPPORT_EMAIL}</Text>
              </Pressable>
            ) : null}
          </View>
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
  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
  },
  backLink: { marginBottom: 8 },
  backText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  heading: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: 18, marginBottom: 6 },
  paragraph: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 4 },

  qa: { marginBottom: 18 },
  question: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary, marginBottom: 5 },
  answer: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },

  contactBtn: {
    marginTop: 24,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  contactBtnText: { color: colors.bgWhite, fontSize: 14, fontWeight: '700' },
});
