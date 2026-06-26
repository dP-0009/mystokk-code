import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { FormTextField } from '../components/shared/FormTextField';
import { AppButton } from '../components/shared/AppButton';
import { GoogleButton } from '../components/shared/GoogleButton';
import { AuthDivider } from '../components/shared/AuthDivider';
import { requestSignupOtp, signInWithGoogle } from '../services/supabase/auth';
import { setSignupDraft } from '../stores/signupDraft';
import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH } from '../utils/validation';
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
    <View style={styles.fill}>
      <ScreenHeader title="Create Account" onBack={() => navigation.navigate('Landing')} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Get started</Text>
          <Text style={styles.sub}>Just your email and password — we&apos;ll get your company profile next</Text>

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

          <AppButton title="Create Account" onPress={onSubmit} loading={submitting} />

          <AuthDivider />

          <GoogleButton title="Sign up with Google" onPress={onGoogle} loading={googleLoading} />

          <Text style={styles.footer}>
            Already have an account?{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
              Log in
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  body: { padding: 24 },
  title: { fontSize: 24, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  sub: { fontSize: 13, color: colors.slate500, marginBottom: 24 },
  hint: { fontSize: 11, color: colors.slate400, marginBottom: 18, lineHeight: 16 },
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  footer: { textAlign: 'center', marginTop: 24, fontSize: 13, color: colors.slate500 },
  link: { color: colors.emerald, fontWeight: '700' },
});
