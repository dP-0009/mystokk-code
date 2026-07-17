import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { signIn } from '../services/supabase/auth';
import { SocialAuthButtons } from '../components/auth/SocialAuthButtons';
import { EMAIL_PATTERN } from '../utils/validation';
import {
  Button,
  NavBar,
  ScreenBackground,
  TextField,
  colors,
  layout,
  spacing,
} from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

interface LoginForm {
  email: string;
  password: string;
}

/** Login (prototype SCREENS.login). Auth calls are the same services the web form uses. */
export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { control, handleSubmit } = useForm<LoginForm>({ defaultValues: { email: '', password: '' } });

  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

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

  return (
    <ScreenBackground>
      {/* No back button once the stack has been reset here (e.g. after a password reset). */}
      <NavBar onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + layout.navHeight - 56 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.h1}>Welcome back</Text>
          <Text style={styles.sub}>Log in to continue</Text>

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
          <Controller
            control={control}
            name="password"
            rules={{ required: 'Password is required' }}
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <TextField
                label="Password"
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={error?.message}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
              />
            )}
          />

          <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8} style={styles.forgotWrap}>
            <Text style={styles.forgot}>Forgot password?</Text>
          </Pressable>

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <Button label="Log in" variant="primary" onPress={() => void onSubmit()} disabled={submitting} />

          {/* Form first, then OR + social sign-in below. */}
          <SocialAuthButtons onError={setFormError} />

          <Text style={styles.footer}>
            New to MyStokk?{' '}
            <Text style={styles.link} onPress={() => navigation.replace('Signup')}>
              Create account
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
  forgotWrap: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 20 },
  forgot: { fontSize: 13.5, fontWeight: '800', color: colors.blue },
  error: { color: colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  footer: { textAlign: 'center', fontSize: 14, color: colors.muted, marginTop: 18 },
  link: { color: colors.blue, fontWeight: '800' },
});
