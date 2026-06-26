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
import { signIn, signInWithGoogle } from '../services/supabase/auth';
import { EMAIL_PATTERN } from '../utils/validation';
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

  return (
    <View style={styles.fill}>
      <ScreenHeader title="Log In" onBack={() => navigation.navigate('Landing')} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Log in to access your private inventory network</Text>

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

          <Text style={styles.forgot} onPress={() => navigation.navigate('ForgotPassword')}>
            Forgot password?
          </Text>

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <AppButton title="Log In" onPress={onSubmit} loading={submitting} />

          <AuthDivider />

          <GoogleButton title="Continue with Google" onPress={onGoogle} loading={googleLoading} />

          <Text style={styles.footer}>
            Don&apos;t have an account?{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('Signup')}>
              Sign up
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
  forgot: { alignSelf: 'flex-end', color: colors.emerald, fontWeight: '600', fontSize: 13, marginBottom: 18 },
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  footer: { textAlign: 'center', marginTop: 24, fontSize: 13, color: colors.slate500 },
  link: { color: colors.emerald, fontWeight: '700' },
});
