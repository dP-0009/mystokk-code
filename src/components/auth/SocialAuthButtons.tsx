import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { isAppleSignInAvailable, signInWithApple, signInWithGoogle } from '../../services/supabase/auth';
import { Button, colors } from '../mobile';

// Copied from C:\Users\DARSHIL\Downloads → assets/apple-logo.png (white glyph).
const APPLE_LOGO = require('../../../assets/apple-logo.png');

/** Google's 4-colour "G". */
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

/** Apple logo (white PNG), sized to match the Google "G". */
function AppleLogo(): React.JSX.Element {
  return <Image source={APPLE_LOGO} style={styles.apple} resizeMode="contain" />;
}

/**
 * Shared "OR + Continue with Google / Apple" block — NATIVE ONLY. Placed BELOW
 * the email/password form on both Login and Signup, running the SAME Supabase
 * OAuth calls (signup and login are identical to Supabase). Apple is iOS-only.
 * Errors bubble up via onError so each screen shows them in its own error slot.
 */
export function SocialAuthButtons({ onError }: { onError: (message: string | null) => void }): React.JSX.Element {
  const [googleLoading, setGoogleLoading] = React.useState(false);

  const onGoogle = async (): Promise<void> => {
    onError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const onApple = async (): Promise<void> => {
    onError(null);
    try {
      await signInWithApple();
    } catch (err) {
      // Apple's native cancel isn't an error worth surfacing.
      if ((err as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return;
      onError(err instanceof Error ? err.message : 'Apple sign-in failed.');
    }
  };

  return (
    <>
      <View style={styles.dividerRow}>
        <View style={styles.rule} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.rule} />
      </View>

      <Button
        label="Continue with Google"
        variant="ghost"
        icon={<GoogleG />}
        onPress={() => void onGoogle()}
        disabled={googleLoading}
      />

      {/* Apple sign-in on iOS: App Store policy requires it wherever Google is offered. */}
      {isAppleSignInAvailable() ? (
        <View style={styles.appleWrap}>
          <Button label="Continue with Apple" variant="dark" icon={<AppleLogo />} onPress={() => void onApple()} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  apple: { width: 20, height: 20 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontSize: 12.5, fontWeight: '700', color: '#A6B3C9' },
  appleWrap: { marginTop: 10 },
});
