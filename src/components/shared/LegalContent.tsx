import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';

import { webOnly } from '../layout/web';
import { FormTextField } from './FormTextField';
import { DropdownSelectField } from './DropdownSelectField';
import { AppButton } from './AppButton';
import { MystokkLoader } from './MystokkLoader';
import { getMyVendor } from '../../services/supabase/vendor';
import { useAuthStore } from '../../stores/authStore';
import {
  SUPPORT_MIN_MESSAGE,
  SUPPORT_TOPICS,
  sendSupportMessage,
  type SupportTopic,
} from '../../services/supabase/support';
import { colors } from '../../theme/tokens';
import { faq, privacy, terms, type LegalBlock, type LegalMeta } from '../../content/legal';

/**
 * Legal / support content renderer (web). All legal COPY lives in
 * src/content/legal/*; this file only renders it (plus the working Contact form).
 */
export type LegalPage = 'faq' | 'privacy' | 'terms' | 'contact';

/** Page title/subtitle for the page header — derived from the content source. */
export const LEGAL_PAGES: Record<LegalPage, { title: string; subtitle: string }> = {
  faq: { title: faq.title, subtitle: faq.subtitle },
  privacy: { title: privacy.title, subtitle: privacy.subtitle },
  terms: { title: terms.title, subtitle: terms.subtitle },
  contact: { title: 'Contact', subtitle: 'We’re here to help' },
};

function MetaLine({ meta }: { meta: LegalMeta }): React.JSX.Element {
  return (
    <Text style={styles.meta}>
      Version {meta.version} · Effective {meta.effectiveDate} · Last updated {meta.lastUpdated}
    </Text>
  );
}

function Blocks({ blocks }: { blocks: LegalBlock[] }): React.JSX.Element {
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <Text key={i} style={styles.paragraph}>
            {b.text}
          </Text>
        ) : (
          <View key={i} style={styles.list}>
            {b.items.map((item, j) => (
              <View key={j} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        ),
      )}
    </>
  );
}

/** Renders one legal page's body card. */
export function LegalContent({ page }: { page: LegalPage }): React.JSX.Element {
  if (page === 'contact') {
    return (
      <View style={styles.card}>
        <ContactForm />
      </View>
    );
  }

  if (page === 'faq') {
    return (
      <View style={styles.card}>
        <MetaLine meta={faq.meta} />
        {faq.categories.map((cat) => (
          <View key={cat.id}>
            <Text style={styles.categoryName}>{cat.name}</Text>
            {cat.items.map((item, i) => (
              <View key={i} style={styles.qa}>
                <Text style={styles.question}>{item.question}</Text>
                <Text style={styles.answer}>{item.answer}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  const doc = page === 'privacy' ? privacy : terms;
  return (
    <View style={styles.card}>
      <MetaLine meta={doc.meta} />
      <Blocks blocks={doc.intro} />
      {doc.sections.map((section) => (
        <View key={section.id}>
          <Text style={styles.sectionHeading}>{section.heading}</Text>
          <Blocks blocks={section.body} />
        </View>
      ))}
    </View>
  );
}

interface ContactFormValues {
  name: string;
  email: string;
  topic: string;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Web Contact / support form — same fields + same edge function as the app.
 * Prefills name/email from the vendor profile when signed in (the page is also
 * reachable by signed-out visitors, who get an empty form). Inline validation;
 * MystokkLoader while submitting; success state on completion.
 */
function ContactForm(): React.JSX.Element {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const { data: vendor } = useQuery({
    queryKey: ['myVendor'],
    queryFn: getMyVendor,
    staleTime: 30_000,
    enabled: signedIn,
  });

  const { control, handleSubmit, reset } = useForm<ContactFormValues>({
    defaultValues: { name: '', email: '', topic: '', message: '' },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [seeded, setSeeded] = React.useState(false);

  // Seed name/email once the vendor profile loads.
  React.useEffect(() => {
    if (vendor && !seeded) {
      reset({ name: vendor.contact_person ?? '', email: vendor.email ?? '', topic: '', message: '' });
      setSeeded(true);
    }
  }, [vendor, seeded, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSubmitting(true);
    try {
      await sendSupportMessage({
        name: values.name.trim(),
        email: values.email.trim(),
        topic: values.topic as SupportTopic,
        message: values.message.trim(),
      });
      reset({ name: vendor?.contact_person ?? '', email: vendor?.email ?? '', topic: '', message: '' });
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send your message.');
    } finally {
      setSubmitting(false);
    }
  });

  if (done) {
    return (
      <View style={styles.success}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={30} color={colors.emerald} />
        </View>
        <Text style={styles.successTitle}>Message sent</Text>
        <Text style={styles.successSub}>We&apos;ll get back to you within one business day.</Text>
        <Pressable onPress={() => setDone(false)} style={webOnly({ cursor: 'pointer' })}>
          <Text style={styles.successLink}>Send another message</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.formIntro}>Send us a message and we&apos;ll get back to you within one business day.</Text>

      <FormTextField
        control={control}
        name="name"
        label="Name *"
        placeholder="Your name"
        rules={{ required: 'Name is required' }}
      />
      <FormTextField
        control={control}
        name="email"
        label="Email *"
        placeholder="you@company.com"
        keyboardType="email-address"
        rules={{
          required: 'Email is required',
          pattern: { value: EMAIL_RE, message: 'Enter a valid email' },
        }}
      />
      <DropdownSelectField
        control={control}
        name="topic"
        label="Topic *"
        placeholder="Select a topic"
        options={SUPPORT_TOPICS}
        rules={{ required: 'Choose a topic' }}
      />
      <FormTextField
        control={control}
        name="message"
        label="Message *"
        placeholder="How can we help?"
        multiline
        rules={{
          required: 'Message is required',
          minLength: { value: SUPPORT_MIN_MESSAGE, message: `At least ${SUPPORT_MIN_MESSAGE} characters` },
        }}
      />

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      {submitting ? (
        <View style={styles.formLoading}>
          <MystokkLoader showText={false} size={44} />
        </View>
      ) : (
        <AppButton title="Send message" onPress={() => void onSubmit()} style={styles.formSubmit} />
      )}
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
  meta: { fontSize: 12.5, color: colors.textMuted, marginBottom: 16 },
  sectionHeading: { fontSize: 15.5, fontWeight: '800', color: colors.textPrimary, marginTop: 22, marginBottom: 8 },
  paragraph: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 8 },
  list: { marginBottom: 8, gap: 6 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletDot: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  categoryName: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.accent,
    marginTop: 22,
    marginBottom: 10,
  },
  qa: { marginBottom: 18 },
  question: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary, marginBottom: 5 },
  answer: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },

  formIntro: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 18 },
  formSubmit: { marginTop: 8, alignSelf: 'flex-start' },
  formLoading: { marginTop: 12, alignItems: 'flex-start' },
  formError: { color: colors.red, fontSize: 13, fontWeight: '600', marginTop: 8 },
  success: { alignItems: 'center', paddingVertical: 20 },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(5,150,105,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: { fontSize: 19, fontWeight: '800', color: colors.textPrimary },
  successSub: { fontSize: 14, color: colors.textSecondary, marginTop: 6, textAlign: 'center' },
  successLink: { fontSize: 14, fontWeight: '700', color: colors.accent, marginTop: 18 },
});
