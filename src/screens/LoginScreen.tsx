import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { AuthShell } from '../components/shared/AuthShell';
import { FormTextField } from '../components/shared/FormTextField';
import { AppButton } from '../components/shared/AppButton';
import { GoogleButton } from '../components/shared/GoogleButton';
import { AppleSignInButton } from '../components/shared/AppleButton';
import { AuthDivider } from '../components/shared/AuthDivider';
import { signIn, signInWithApple, signInWithGoogle } from '../services/supabase/auth';
import { EMAIL_PATTERN } from '../utils/validation';
import { webOnly } from '../components/layout/web';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

interface LoginForm {
  email: string;
  password: string;
}

export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const { control, handleSubmit } = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
  });
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // The reactive navigator routes onward once the session is set.
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not log in.');
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

  const onApple = async (): Promise<void> => {
    setFormError(null);
    try {
      await signInWithApple();
    } catch (err) {
      // Apple's native cancel isn't an error worth surfacing.
      if ((err as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return;
      setFormError(err instanceof Error ? err.message : 'Apple sign-in failed.');
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to access your private inventory network."
      onBack={() => navigation.navigate('Landing')}
      footer={
        <Text style={styles.footer}>
          Don&apos;t have an account?{' '}
          <Text style={[styles.link, webOnly({ cursor: 'pointer' })]} onPress={() => navigation.navigate('Signup')}>
            Sign up
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
        placeholder="Enter your password"
        secureToggle
        rules={{ required: 'Password is required' }}
      />

      <Text
        style={[styles.forgot, webOnly({ cursor: 'pointer' })]}
        onPress={() => navigation.navigate('ForgotPassword')}
      >
        Forgot password?
      </Text>

      {formError ? <Text style={styles.error}>{formError}</Text> : null}

      <AppButton title="Log In" variant="primary" onPress={onSubmit} loading={submitting} />

      <AuthDivider />

      <GoogleButton title="Continue with Google" onPress={onGoogle} loading={googleLoading} />
      <AppleSignInButton onPress={() => void onApple()} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', color: colors.accent, fontWeight: '600', fontSize: 13, marginBottom: 18 },
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  footer: { textAlign: 'center', fontSize: 13, color: colors.textSecondary },
  link: { color: colors.accent, fontWeight: '700' },
});
