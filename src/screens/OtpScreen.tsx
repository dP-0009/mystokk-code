import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { AppButton } from '../components/shared/AppButton';
import { requestPasswordReset, requestSignupOtp, signUp, verifyOtp } from '../services/supabase/auth';
import { clearSignupDraft, getSignupDraft } from '../stores/signupDraft';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

const OTP_LENGTH = 6;
const EXPIRY_SECONDS = 10 * 60;

function formatClock(total: number): string {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function OtpScreen({ navigation, route }: Props): React.JSX.Element {
  const { email, purpose } = route.params;

  const [digits, setDigits] = useState<string[]>(() => Array<string>(OTP_LENGTH).fill(''));
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputs = useRef<Array<TextInput | null>>([]);
  const code = useMemo(() => digits.join(''), [digits]);
  const expired = secondsLeft <= 0;

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const setDigit = (index: number, char: string): void => {
    const clean = char.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (clean && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const onKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ): void => {
    if (e.nativeEvent.key === 'Backspace' && digits[index] === '' && index > 0) {
      inputs.current[index - 1]?.focus();
      setDigit(index - 1, '');
    }
  };

  const onResend = async (): Promise<void> => {
    setError(null);
    try {
      if (purpose === 'signup') {
        await requestSignupOtp(email);
      } else {
        await requestPasswordReset(email);
      }
      setSecondsLeft(EXPIRY_SECONDS);
      setNotice('Code resent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code.');
    }
  };

  const onVerify = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      if (purpose === 'reset') {
        // Do NOT consume the code here — the reset-password Edge Function
        // verifies + consumes it together with the new password.
        navigation.navigate('NewPassword', { email, otp: code });
        return;
      }

      const valid = await verifyOtp(email, code, 'signup');
      if (!valid) {
        setError('Invalid or expired code.');
        return;
      }
      const draft = getSignupDraft();
      if (!draft) {
        setError('Your signup session expired. Please start again.');
        navigation.navigate('Signup');
        return;
      }
      // Create the account now → session appears → navigator routes to Onboarding.
      await signUp(draft.email, draft.password);
      clearSignupDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.fill}>
      <ScreenHeader
        title={purpose === 'signup' ? 'Verify Email' : 'Verify Code'}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.body}>
        <Text style={styles.emoji}>📧</Text>
        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.sub}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>

        <View style={styles.boxes}>
          {digits.map((digit, i) => (
            <TextInput
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              style={[styles.box, digit ? styles.boxFilled : null]}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(t) => setDigit(i, t)}
              onKeyPress={(e) => onKeyPress(i, e)}
              returnKeyType="done"
              autoFocus={i === 0}
            />
          ))}
        </View>

        <Text style={styles.timer}>
          {expired ? 'Code expired — request a new one' : <>Code expires in <Text style={styles.timerStrong}>{formatClock(secondsLeft)}</Text></>}
        </Text>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton
          title="Verify & Continue"
          onPress={onVerify}
          loading={submitting}
          disabled={code.length < OTP_LENGTH || expired}
        />

        <Text style={styles.resend}>
          Didn&apos;t get it?{' '}
          <Text style={styles.link} onPress={onResend}>
            Resend code
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  body: { padding: 24, alignItems: 'center' },
  emoji: { fontSize: 40, marginVertical: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.navy, marginBottom: 6 },
  sub: { fontSize: 13, color: colors.slate500, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  email: { fontWeight: '700', color: colors.slate700 },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 20 },
  box: {
    width: 46,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.navy,
  },
  boxFilled: { borderColor: colors.emerald },
  timer: { fontSize: 12, color: colors.slate400, marginBottom: 18 },
  timerStrong: { fontWeight: '700', color: colors.slate700 },
  notice: { fontSize: 13, color: colors.emerald, fontWeight: '600', marginBottom: 10 },
  error: { fontSize: 13, color: colors.red, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  resend: { marginTop: 16, fontSize: 13, color: colors.slate500 },
  link: { color: colors.emerald, fontWeight: '700' },
});
