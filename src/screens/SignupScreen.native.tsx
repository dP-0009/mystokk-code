import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { requestSignupOtp } from '../services/supabase/auth';
import { SocialAuthButtons } from '../components/auth/SocialAuthButtons';
import { setSignupDraft } from '../stores/signupDraft';
import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH } from '../utils/validation';
import { Button, NavBar, ScreenBackground, TextField, colors, layout, spacing } from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

interface SignupForm {
  email: string;
  password: string;
  confirm: string;
}

/**
 * Signup (prototype SCREENS.signup). Identical flow to the web form: the account
 * is NOT created here — the password is stashed in the signup draft and an OTP is
 * sent; OtpScreen creates the account after the code verifies.
 */
export function SignupScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { control, handleSubmit, getValues } = useForm<SignupForm>({
    defaultValues: { email: '', password: '', confirm: '' },
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    setSubmitting(true);
    try {
      setSignupDraft({ email: email.trim().toLowerCase(), password });
      await requestSignupOtp(email);
      navigation.navigate('Otp', { email: email.trim().toLowerCase(), purpose: 'signup' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not start signup.');
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
          <Text style={styles.h1}>Create account</Text>
          <Text style={styles.sub}>Start sharing stock in minutes</Text>

          <Controller
            control={control}
            name="email"
            rules={{
              required: 'Email is required',
              pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email' },
            }}
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <TextField
                label="Work email"
                required
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
          <Controller
            control={control}
            name="password"
            rules={{
              required: 'Password is required',
              minLength: { value: MIN_PASSWORD_LENGTH, message: `At least ${MIN_PASSWORD_LENGTH} characters` },
            }}
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <TextField
                label="Password"
                required
                placeholder="Minimum 8 characters"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={error?.message}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
              />
            )}
          />
          <Controller
            control={control}
            name="confirm"
            rules={{
              required: 'Please confirm your password',
              validate: (value) => value === getValues('password') || 'Passwords do not match',
            }}
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <TextField
                label="Confirm password"
                required
                placeholder="Repeat password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={error?.message}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
              />
            )}
          />

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <Button
            label="Continue"
            variant="primary"
            onPress={() => void onSubmit()}
            disabled={submitting}
            style={styles.cta}
          />

          {/* Form first, then OR + social sign-in (same OAuth as Login). */}
          <SocialAuthButtons onError={setFormError} />

          <Text style={styles.legal}>
            By continuing you agree to the{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('Legal', { page: 'terms' })}>
              Terms
            </Text>{' '}
            and{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('Legal', { page: 'privacy' })}>
              Privacy Policy
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: 44 },
  h1: { fontSize: 29, fontWeight: '800', letterSpacing: -0.6, color: colors.navy },
  sub: { fontSize: 14.5, color: colors.muted, marginTop: 3, marginBottom: 24 },
  cta: { marginTop: 6 },
  error: { color: colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  legal: { textAlign: 'center', fontSize: 12.5, color: colors.muted, marginTop: 15, lineHeight: 19 },
  link: { color: colors.blue, fontWeight: '800' },
});
