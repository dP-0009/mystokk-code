import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { signIn, signInWithApple, signInWithGoogle, isAppleSignInAvailable } from '../services/supabase/auth';
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

/** Google's 4-colour "G" (the prototype's inline SVG). */
function GoogleG({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.8z" />
      <Path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.2-6.9-5.2H1.2v3C3.2 21.3 7.3 24 12 24z" />
      <Path fill="#FBBC05" d="M5.1 14.2a7.3 7.3 0 0 1 0-4.5v-3H1.2a12 12 0 0 0 0 10.6l3.9-3.1z" />
      <Path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l2.7-2.7C16.9 1.2 14.7 0 12 0 7.3 0 3.2 2.7 1.2 6.7l3.9 3C6 6.9 8.8 4.7 12 4.7z" />
    </Svg>
  );
}

/** Login (prototype SCREENS.login). Auth calls are the same services the web form uses. */
export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { control, handleSubmit } = useForm<LoginForm>({ defaultValues: { email: '', password: '' } });

  const [submitting, setSubmitting] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
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
    <ScreenBackground>
      <NavBar onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + layout.navHeight - 56 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.h1}>Welcome back</Text>
          <Text style={styles.sub}>Log in to continue</Text>

          <Button
            label="Continue with Google"
            variant="ghost"
            icon={<GoogleG />}
            onPress={() => void onGoogle()}
            disabled={googleLoading}
          />

          {/* Apple sign-in stays on iOS: the App Store requires it wherever a
              third-party sign-in is offered. Not in the prototype, kept for policy. */}
          {isAppleSignInAvailable() ? (
            <View style={styles.appleWrap}>
              <Button label="Continue with Apple" variant="dark" onPress={() => void onApple()} />
            </View>
          ) : null}

          <View style={styles.dividerRow}>
            <View style={styles.rule} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.rule} />
          </View>

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
  appleWrap: { marginTop: 10 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontSize: 12.5, fontWeight: '700', color: '#A6B3C9' },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 20 },
  forgot: { fontSize: 13.5, fontWeight: '800', color: colors.blue },
  error: { color: colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  footer: { textAlign: 'center', fontSize: 14, color: colors.muted, marginTop: 18 },
  link: { color: colors.blue, fontWeight: '800' },
});
