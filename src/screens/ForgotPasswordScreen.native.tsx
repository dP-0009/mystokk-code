import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { requestPasswordReset } from '../services/supabase/auth';
import { EMAIL_PATTERN } from '../utils/validation';
import { Button, NavBar, ScreenBackground, TextField, colors, layout, spacing } from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

interface ForgotForm {
  email: string;
}

/**
 * Reset password (prototype SCREENS.forgot).
 *
 * The prototype mails a reset *link* and pops back. The real app sends a 6-digit
 * code and continues to Otp → NewPassword, so this fork keeps the existing flow
 * (rule 2: no auth-flow changes) and restyles only. Copy is adjusted to match
 * what actually happens.
 */
export function ForgotPasswordScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { control, handleSubmit } = useForm<ForgotForm>({ defaultValues: { email: '' } });

  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      navigation.navigate('Otp', { email: email.trim().toLowerCase(), purpose: 'reset' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send reset code.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <ScreenBackground>
      <NavBar onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + layout.navHeight - 56 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.h1}>Reset password</Text>
          <Text style={styles.sub}>We&apos;ll email you a 6-digit reset code</Text>

          <Controller
            control={control}
            name="email"
            rules={{
              required: 'Email is required',
              pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email' },
            }}
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <TextField
                label="Email"
                placeholder="you@company.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={error?.message}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
            )}
          />

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <Button
            label="Send reset code"
            variant="primary"
            onPress={() => void onSubmit()}
            disabled={submitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: 44 },
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.navy },
  sub: { fontSize: 14.5, color: colors.muted, marginTop: 3, marginBottom: 24 },
  error: { color: colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
});
