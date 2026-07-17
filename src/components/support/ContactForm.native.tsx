import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { getMyVendor } from '../../services/supabase/vendor';
import {
  SUPPORT_MIN_MESSAGE,
  SUPPORT_TOPICS,
  sendSupportMessage,
  type SupportTopic,
} from '../../services/supabase/support';
import { Button, Icon, PickerSheet, Select, TextArea, TextField, colors } from '../mobile';
import { MystokkLoader } from '../shared/MystokkLoader';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<'name' | 'email' | 'topic' | 'message', string>>;

/**
 * Native Contact / support form. Prefills name + email from the vendor profile
 * (editable), validates inline (no alerts), submits through the shared
 * send-support-message service, then shows a success state.
 */
export function ContactForm(): React.JSX.Element {
  // Best-effort prefill — the screen is normally reached signed in.
  const { data: vendor } = useQuery({ queryKey: ['myVendor'], queryFn: getMyVendor, staleTime: 30_000 });

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [topic, setTopic] = React.useState<SupportTopic | ''>('');
  const [message, setMessage] = React.useState('');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [seeded, setSeeded] = React.useState(false);

  // Seed name/email once the vendor loads (only if the user hasn't typed yet).
  React.useEffect(() => {
    if (vendor && !seeded) {
      setName((n) => n || vendor.contact_person || '');
      setEmail((e) => e || vendor.email || '');
      setSeeded(true);
    }
  }, [vendor, seeded]);

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = 'Name is required';
    if (!email.trim()) next.email = 'Email is required';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email';
    if (!topic) next.topic = 'Choose a topic';
    if (!message.trim()) next.message = 'Message is required';
    else if (message.trim().length < SUPPORT_MIN_MESSAGE) next.message = `At least ${SUPPORT_MIN_MESSAGE} characters`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const reset = (): void => {
    setName(vendor?.contact_person || '');
    setEmail(vendor?.email || '');
    setTopic('');
    setMessage('');
    setErrors({});
    setFormError(null);
  };

  const onSubmit = async (): Promise<void> => {
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await sendSupportMessage({ name: name.trim(), email: email.trim(), topic: topic as SupportTopic, message: message.trim() });
      reset();
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send your message.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <View style={styles.successWrap}>
        <View style={styles.successIcon}>
          <Icon name="check" size={36} color={colors.green} />
        </View>
        <Text style={styles.successTitle}>Message sent</Text>
        <Text style={styles.successSub}>We&apos;ll get back to you within one business day.</Text>
        <Button label="Send another message" variant="ghost" onPress={() => setDone(false)} style={styles.successBtn} />
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.h1}>We&apos;re here to help</Text>
      <Text style={styles.sub}>Send us a message and we&apos;ll get back to you within one business day.</Text>

      <TextField
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
        }}
        placeholder="Your name"
        autoCapitalize="words"
        error={errors.name}
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
        }}
        placeholder="you@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.email}
      />
      <Select
        label="Topic"
        value={topic || undefined}
        placeholder="Select a topic"
        onPress={() => setPickerOpen(true)}
        error={errors.topic}
      />
      <TextArea
        label="Message"
        value={message}
        onChangeText={(v) => {
          setMessage(v);
          if (errors.message) setErrors((e) => ({ ...e, message: undefined }));
        }}
        placeholder="How can we help?"
        autoCapitalize="sentences"
        error={errors.message}
      />

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      {submitting ? (
        <View style={styles.loading}>
          <MystokkLoader showText={false} size={44} />
        </View>
      ) : (
        <Button label="Send message" variant="primary" onPress={() => void onSubmit()} style={styles.submit} />
      )}

      <PickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Topic"
        options={SUPPORT_TOPICS}
        value={topic || undefined}
        onSelect={(v) => {
          setTopic(v as SupportTopic);
          if (errors.topic) setErrors((e) => ({ ...e, topic: undefined }));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.navy, marginTop: 2 },
  sub: { fontSize: 14.5, color: colors.muted, marginTop: 3, marginBottom: 18 },
  submit: { marginTop: 6 },
  loading: { marginTop: 10, alignItems: 'center' },
  formError: { color: colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 4, marginBottom: 4 },

  successWrap: { alignItems: 'center', paddingTop: 30 },
  successIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(20,154,84,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.navy },
  successSub: { fontSize: 14.5, color: colors.muted, marginTop: 8, textAlign: 'center' },
  successBtn: { marginTop: 22, alignSelf: 'stretch' },
});
