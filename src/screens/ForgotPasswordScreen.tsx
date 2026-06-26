import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { FormTextField } from '../components/shared/FormTextField';
import { AppButton } from '../components/shared/AppButton';
import { requestPasswordReset } from '../services/supabase/auth';
import { EMAIL_PATTERN } from '../utils/validation';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

interface ForgotForm {
  email: string;
}

export function ForgotPasswordScreen({ navigation }: Props): React.JSX.Element {
  const { control, handleSubmit } = useForm<ForgotForm>({ defaultValues: { email: '' } });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    <View style={styles.fill}>
      <ScreenHeader title="Reset Password" onBack={() => navigation.navigate('Login')} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Forgot your password?</Text>
          <Text style={styles.sub}>Enter your email and we&apos;ll send a 6-digit reset code</Text>

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

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <AppButton title="Send Reset Code" onPress={onSubmit} loading={submitting} />
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
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
});
