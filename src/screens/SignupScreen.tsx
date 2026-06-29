import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { AuthShell } from '../components/shared/AuthShell';
import { FormTextField } from '../components/shared/FormTextField';
import { AppButton } from '../components/shared/AppButton';
import { GoogleButton } from '../components/shared/GoogleButton';
import { AuthDivider } from '../components/shared/AuthDivider';
import { requestSignupOtp, signInWithGoogle } from '../services/supabase/auth';
import { setSignupDraft } from '../stores/signupDraft';
import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH } from '../utils/validation';
import { webOnly } from '../components/layout/web';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

interface SignupForm {
  email: string;
  password: string;
  confirm: string;
}

export function SignupScreen({ navigation }: Props): React.JSX.Element {
  const { control, handleSubmit, getValues } = useForm<SignupForm>({
    defaultValues: { email: '', password: '', confirm: '' },
  });
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    setSubmitting(true);
    try {
      // Account is created only AFTER the OTP is verified — stash the password
      // and send the code first.
      setSignupDraft({ email: email.trim().toLowerCase(), password });
      await requestSignupOtp(email);
      navigation.navigate('Otp', { email: email.trim().toLowerCase(), purpose: 'signup' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not start signup.');
    } finally {
      setSubmitting(false);
    }
  });

  const onGoogle = async (): Promise<void> => {
    setFormError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell
      title="Get started"
      subtitle="Just your email and password — we'll set up your company profile next."
      onBack={() => navigation.navigate('Landing')}
      footer={
        <Text style={styles.footer}>
          Already have an account?{' '}
          <Text style={[styles.link, webOnly({ cursor: 'pointer' })]} onPress={() => navigation.navigate('Login')}>
            Log in
          </Text>
        </Text>
      }
    >
      <FormTextField
        control={control}
        name="email"
        label="Email"
        placeholder="you@company.com"
        keyboardType="email-address"
        rules={{
          required: 'Email is required',
          pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email' },
        }}
      />
      <FormTextField
        control={control}
        name="password"
        label="Password"
        placeholder="Minimum 8 characters"
        secureToggle
        rules={{
          required: 'Password is required',
          minLength: { value: MIN_PASSWORD_LENGTH, message: `At least ${MIN_PASSWORD_LENGTH} characters` },
        }}
      />
      <FormTextField
        control={control}
        name="confirm"
        label="Confirm Password"
        placeholder="Re-enter your password"
        secureToggle
        rules={{
          required: 'Please confirm your password',
          validate: (value) => value === getValues('password') || 'Passwords do not match',
        }}
      />

      <Text style={styles.hint}>
        By signing up you agree to our <Text style={styles.link}>Terms</Text> and{' '}
        <Text style={styles.link}>Privacy Policy</Text>
      </Text>

      {formError ? <Text style={styles.error}>{formError}</Text> : null}

      <AppButton title="Create Account" variant="primary" onPress={onSubmit} loading={submitting} />

      <AuthDivider />

      <GoogleButton title="Sign up with Google" onPress={onGoogle} loading={googleLoading} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 11, color: colors.textMuted, marginBottom: 18, lineHeight: 16 },
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  footer: { textAlign: 'center', fontSize: 13, color: colors.textSecondary },
  link: { color: colors.accent, fontWeight: '700' },
});
