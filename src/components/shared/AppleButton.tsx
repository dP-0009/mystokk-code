import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Native "Sign in with Apple" button. Renders ONLY on iOS (returns null
 * everywhere else) — Apple's HIG requires their own button, and the flow is
 * iOS-only. Required by App Store guideline 4.8 since we also offer Google.
 */
export function AppleSignInButton({ onPress }: { onPress: () => void }): React.JSX.Element | null {
  if (Platform.OS !== 'ios') return null;
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={10}
      style={styles.button}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  button: { width: '100%', height: 48, marginTop: 10 },
});
