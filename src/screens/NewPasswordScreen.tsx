import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { FormTextField } from '../components/shared/FormTextField';
import { AppButton } from '../components/shared/AppButton';
import { resetPasswordWithOtp } from '../services/supabase/auth';
import { MIN_PASSWORD_LENGTH } from '../utils/validation';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'NewPassword'>;

interface NewPasswordForm {
  password: string;
  confirm: string;
}

export function NewPasswordScreen({ navigation, route }: Props): React.JSX.Element {
  const { email, otp } = route.params;
  const { control, handleSubmit, getValues } = useForm<NewPasswordForm>({
    defaultValues: { password: '', confirm: '' },
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  return (
    <View style={styles.fill}>
      <ScreenHeader title="New Password" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {done ? (
            <View style={styles.doneWrap}>
              <Text style={styles.emoji}>✅</Text>
              <Text style={styles.title}>Password updated</Text>
              <Text style={styles.sub}>You can now log in with your new password.</Text>
              <AppButton title="Back to Log In" onPress={() => navigation.navigate('Login')} />
            </View>
          ) : (
            <>
              <Text style={styles.title}>Set a new password</Text>
              <Text style={styles.sub}>Choose a strong password for {email}</Text>

              <FormTextField
                control={control}
                name="password"
                label="New Password"
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

              {formError ? <Text style={styles.error}>{formError}</Text> : null}

              <AppButton title="Update Password" onPress={onSubmit} loading={submitting} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  body: { padding: 24 },
  doneWrap: { alignItems: 'center', paddingTop: 40 },
  emoji: { fontSize: 44, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  sub: { fontSize: 13, color: colors.slate500, marginBottom: 24, textAlign: 'center' },
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
});
