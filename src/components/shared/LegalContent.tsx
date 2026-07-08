import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { webOnly } from '../layout/web';
import { colors } from '../../theme/tokens';

/**
 * Shared legal/support content (FAQ, Privacy, Terms, Contact). The data and the
 * card renderer live here so both the standalone LegalScreen and the new tabbed
 * Settings page render identical copy from one source.
 */
export type LegalPage = 'faq' | 'privacy' | 'terms' | 'contact';

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

const SUPPORT_EMAIL = 'support@mystokk.com';

export const LEGAL_PAGES: Record<LegalPage, PageContent> = {
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
      { kind: 'p', text: 'MyStokk is operated by Everglobal Trading LLC (Dubai, United Arab Emirates). This policy explains what personal data we collect, why we collect it, and how we protect it. By using MyStokk you agree to the practices described here.' },
      { kind: 'h', text: 'Information we collect' },
      { kind: 'p', text: 'Account & profile: your name (contact person), email address, company name, phone and WhatsApp numbers, and your city and country. Business data: the product photos, inventory, documents, and pricing you add, your network connections, and your reservation and negotiation activity. Technical: basic device and usage information needed to run the service and deliver notifications.' },
      { kind: 'h', text: 'Why we collect it' },
      { kind: 'p', text: 'To provide the platform — creating your account, showing your inventory only to the specific contacts you choose, powering reservations and negotiations, sending share and reservation notifications, and keeping your account secure. We do not use your data for advertising, and we never list your inventory on a public marketplace.' },
      { kind: 'h', text: 'Where your data is stored' },
      { kind: 'p', text: 'Your data is hosted on Supabase, our cloud database and storage provider. Access is enforced with row-level security so each vendor can only reach data they are entitled to. Product photos and documents are kept private and delivered through short-lived signed links.' },
      { kind: 'h', text: 'Sign in with Google & Apple' },
      { kind: 'p', text: 'You can sign in with Google or Apple. When you do, we receive only your basic profile (name and email) to create or access your account. We never receive your Google or Apple password and we do not post anything to those accounts.' },
      { kind: 'h', text: 'Push notifications' },
      { kind: 'p', text: 'With your permission, we send push notifications for shares, reservations, and negotiation updates, delivered via Apple Push Notification service and Firebase Cloud Messaging. You can turn notifications off at any time in your device settings.' },
      { kind: 'h', text: 'Data sharing' },
      { kind: 'p', text: 'We do not sell your data or share it with third parties for their own use. Item details are shared only with the vendors you select or anyone holding a public share link you created. We rely on trusted service providers strictly to operate MyStokk — Supabase (database and storage), our email provider for notifications, and Apple and Google for sign-in and push delivery.' },
      { kind: 'h', text: 'Data retention & deletion' },
      { kind: 'p', text: 'We keep your data for as long as your account is active. You can edit or delete your inventory, and delete your account, at any time from Settings — this removes your data subject to any legal retention requirements. You can also request access to, or deletion of, your data by emailing us using the button below.' },
      { kind: 'h', text: 'Contact us' },
      { kind: 'p', text: 'Everglobal Trading LLC, Dubai, United Arab Emirates. For any privacy question or a data-deletion request, reach us at the address below.' },
    ],
    contact: true,
  },
  terms: {
    title: 'Terms of Service',
    subtitle: 'The agreement for using MyStokk',
    blocks: [
      { kind: 'p', text: 'These Terms of Service govern your use of MyStokk, operated by Everglobal Trading LLC (Dubai, United Arab Emirates). By creating an account you agree to them.' },
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

/** Renders one legal page's body card (blocks + optional contact button). */
export function LegalContent({ page }: { page: LegalPage }): React.JSX.Element {
  const content = LEGAL_PAGES[page];
  return (
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
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
  },
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
