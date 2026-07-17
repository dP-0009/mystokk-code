import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { resetPasswordWithOtp } from '../services/supabase/auth';
import { MIN_PASSWORD_LENGTH } from '../utils/validation';
import {
  Button,
  Icon,
  NavBar,
  ScreenBackground,
  TextField,
  colors,
  layout,
  spacing,
} from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'NewPassword'>;

interface NewPasswordForm {
  password: string;
  confirm: string;
}

/**
 * Set a new password (native, prototype design). Same logic as the web screen:
 * resetPasswordWithOtp verifies + consumes the OTP with the new password, then a
 * success state. "Back to Log In" RESETS the stack to Login so neither this
 * screen nor the success state can be returned to (rule: no back after reset).
 */
export function NewPasswordScreen({ navigation, route }: Props): React.JSX.Element {
  const { email, otp } = route.params;
  const insets = useSafeAreaInsets();
  const { control, handleSubmit, getValues } = useForm<NewPasswordForm>({
    defaultValues: { password: '', confirm: '' },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Once the password is updated, block the back-swipe so the success/new-password
  // screens can't be returned to before the "Back to Log In" reset.
  React.useEffect(() => {
    navigation.setOptions({ gestureEnabled: !done });
  }, [done, navigation]);

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    setSubmitting(true);
    try {
      await resetPasswordWithOtp(email, otp, password);
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not reset your password.');
    } finally {
      setSubmitting(false);
    }
  });

  const backToLogin = (): void => {
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <ScreenBackground>
      <NavBar onBack={done ? undefined : () => navigation.goBack()} />

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + layout.navHeight - 56 },
            done && styles.scrollCenter,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {done ? (
            <View style={styles.doneWrap}>
              <View style={styles.iconGood}>
                <Icon name="check" size={36} color={colors.green} />
              </View>
              <Text style={styles.h1}>Password updated</Text>
              <Text style={styles.subCenter}>You can now log in with your new password.</Text>
              <Button label="Back to Log In" variant="primary" onPress={backToLogin} style={styles.doneBtn} />
            </View>
          ) : (
            <>
              <Text style={styles.h1}>Set a new password</Text>
              <Text style={styles.sub}>Choose a strong password for {email}</Text>

              <Controller
                control={control}
                name="password"
                rules={{
                  required: 'Password is required',
                  minLength: { value: MIN_PASSWORD_LENGTH, message: `At least ${MIN_PASSWORD_LENGTH} characters` },
                }}
                render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
                  <TextField
                    label="New password"
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
                    placeholder="Re-enter your password"
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
                label="Update Password"
                variant="primary"
                onPress={() => void onSubmit()}
                disabled={submitting}
                style={styles.cta}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: 44 },
  scrollCenter: { flexGrow: 1, justifyContent: 'center' },
  h1: { fontSize: 29, fontWeight: '800', letterSpacing: -0.6, color: colors.navy },
  sub: { fontSize: 14.5, color: colors.muted, marginTop: 3, marginBottom: 24 },
  cta: { marginTop: 6 },
  error: { color: colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 12 },

  doneWrap: { alignItems: 'center' },
  iconGood: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(20,154,84,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  subCenter: { fontSize: 14.5, color: colors.muted, marginTop: 8, marginBottom: 26, textAlign: 'center' },
  doneBtn: { alignSelf: 'stretch' },
});
