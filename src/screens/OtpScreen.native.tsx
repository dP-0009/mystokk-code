import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { requestPasswordReset, requestSignupOtp, signUp, verifyOtp } from '../services/supabase/auth';
import { clearSignupDraft, getSignupDraft } from '../stores/signupDraft';
import {
  Button,
  GlassPanel,
  Icon,
  NavBar,
  ScreenBackground,
  colors,
  glass,
  layout,
  spacing,
} from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

const OTP_LENGTH = 6;
const EXPIRY_SECONDS = 10 * 60;

function formatClock(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * OTP (prototype SCREENS.otp). Verification logic is lifted verbatim from the
 * web screen — same services, same signup-draft handoff, same reset branch that
 * defers code consumption to the reset-password Edge Function.
 */
export function OtpScreen({ navigation, route }: Props): React.JSX.Element {
  const { email, purpose } = route.params;
  const insets = useSafeAreaInsets();

  const [digits, setDigits] = React.useState<string[]>(() => Array<string>(OTP_LENGTH).fill(''));
  const [secondsLeft, setSecondsLeft] = React.useState(EXPIRY_SECONDS);
  const [submitting, setSubmitting] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const inputs = React.useRef<Array<TextInput | null>>([]);
  const code = digits.join('');
  const expired = secondsLeft <= 0;

  React.useEffect(() => {
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
    if (clean && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const onKeyPress = (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>): void => {
    if (e.nativeEvent.key === 'Backspace' && digits[index] === '' && index > 0) {
      inputs.current[index - 1]?.focus();
      setDigit(index - 1, '');
    }
  };

  const onResend = async (): Promise<void> => {
    setError(null);
    try {
      if (purpose === 'signup') await requestSignupOtp(email);
      else await requestPasswordReset(email);
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setSubmitting(false);
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
          <View style={styles.icon}>
            <Icon name="mail" size={32} color={colors.blue} />
          </View>

          <Text style={styles.h1}>Check your inbox</Text>
          <Text style={styles.sub}>
            We sent a 6-digit code to <Text style={styles.email}>{email}</Text>
          </Text>

          <View style={styles.boxes}>
            {digits.map((digit, i) => (
              <GlassPanel
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                effect="clear"
                radius={13}
                fill={glass.fillInput}
                style={[styles.box, digit ? styles.boxFilled : null]}
              >
                <TextInput
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  style={styles.boxInput}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(t) => setDigit(i, t)}
                  onKeyPress={(e) => onKeyPress(i, e)}
                  returnKeyType="done"
                  autoFocus={i === 0}
                  textContentType="oneTimeCode"
                />
              </GlassPanel>
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

          <Button
            label={purpose === 'signup' ? 'Verify & Continue' : 'Verify Code'}
            variant="primary"
            onPress={() => void onVerify()}
            disabled={code.length < OTP_LENGTH || expired || submitting}
          />

          <Text style={styles.footer}>
            Didn&apos;t get it?{' '}
            <Text style={styles.link} onPress={() => void onResend()}>
              Resend code
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: 44, alignItems: 'center' },
  icon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    marginBottom: 20,
  },
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.navy },
  sub: { fontSize: 14.5, color: colors.muted, marginTop: 8, textAlign: 'center' },
  email: { fontWeight: '800', color: colors.navy },
  boxes: { flexDirection: 'row', gap: 9, marginTop: 20, marginBottom: 12 },
  box: { width: 46, height: 56 },
  boxFilled: { borderColor: colors.blue },
  boxInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: colors.navy,
  },
  timer: { fontSize: 13.5, color: colors.muted, marginBottom: 22 },
  timerStrong: { fontWeight: '800', color: colors.navy },
  notice: { fontSize: 13, color: colors.green, fontWeight: '700', marginBottom: 10 },
  error: { fontSize: 13, color: colors.red, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  footer: { fontSize: 14, color: colors.muted, marginTop: 18 },
  link: { color: colors.blue, fontWeight: '800' },
});
