import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../../theme/tokens';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide error boundary. Catches any error thrown during render / lifecycle of
 * the tree below it and shows a recoverable fallback instead of a white screen
 * or a hard native crash.
 *
 * This is the render-time safety net; module-level and async throws (which don't
 * pass through React) are caught by the global handler installed in `index.ts`.
 * Together they ensure a startup fault produces a readable message — critical for
 * a TestFlight/production build where there's no Metro red box to read.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    // Goes to the device log (visible in Xcode Console / `adb logcat` / Sentry
    // if wired later). Kept verbose so a crash is actionable from logs alone.
    console.error('[ErrorBoundary] Uncaught render error:', error, info?.componentStack);
  }

  private reset = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.fill}>
        <View style={styles.card}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error while starting up. You can try again — if it keeps
            happening, please reinstall or contact support.
          </Text>
          {/* Surfacing the message is intentional: on a store build this is the
              only place a tester can read what actually failed. */}
          <View style={styles.detailBox}>
            <Text style={styles.detailText} selectable>
              {error.name}: {error.message}
            </Text>
          </View>
          <Pressable style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.bgPage,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    // On web this component may mount before RN layout settles; min height keeps
    // it centered rather than collapsing.
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as unknown as number } : null),
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bgWhite,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
  },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, textAlign: 'center', marginBottom: 18 },
  detailBox: {
    width: '100%',
    backgroundColor: colors.bgPage,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 20,
  },
  detailText: { fontSize: 12, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
