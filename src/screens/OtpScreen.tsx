import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { AuthShell } from '../components/shared/AuthShell';
import { AppButton } from '../components/shared/AppButton';
import { webOnly } from '../components/layout/web';
import { requestPasswordReset, requestSignupOtp, signUp, verifyOtp } from '../services/supabase/auth';
import { clearSignupDraft, getSignupDraft } from '../stores/signupDraft';
import { colors, radius } from '../theme/tokens';

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
    <AuthShell
      title="Check your inbox"
      subtitle={
        <>
          We sent a 6-digit code to <Text style={styles.email}>{email}</Text>
        </>
      }
      onBack={() => navigation.goBack()}
      footer={
        <Text style={styles.resend}>
          Didn&apos;t get it?{' '}
          <Text style={[styles.link, webOnly({ cursor: 'pointer' })]} onPress={onResend}>
            Resend code
          </Text>
        </Text>
      }
    >
      <View style={styles.iconWrap}>
        <Ionicons name="mail-outline" size={26} color={colors.accent} />
      </View>

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
        {expired ? (
          'Code expired — request a new one'
        ) : (
          <>
            Code expires in <Text style={styles.timerStrong}>{formatClock(secondsLeft)}</Text>
          </>
        )}
      </Text>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <AppButton
        title={purpose === 'signup' ? 'Verify & Continue' : 'Verify Code'}
        variant="primary"
        onPress={onVerify}
        loading={submitting}
        disabled={code.length < OTP_LENGTH || expired}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  email: { fontWeight: '700', color: colors.textPrimary },
  iconWrap: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 18 },
  box: {
    width: 46,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgWhite,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    ...({ outlineStyle: 'none' } as object),
  },
  boxFilled: { borderColor: colors.accent },
  timer: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 18 },
  timerStrong: { fontWeight: '700', color: colors.textSecondary },
  notice: { fontSize: 13, color: colors.green, fontWeight: '600', textAlign: 'center', marginBottom: 10 },
  error: { fontSize: 13, color: colors.red, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  resend: { textAlign: 'center', fontSize: 13, color: colors.textSecondary },
  link: { color: colors.accent, fontWeight: '700' },
});
