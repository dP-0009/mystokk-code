import { registerRootComponent } from 'expo';

import App from './App';

/**
 * Global JS fatal handler — installed BEFORE anything else so it captures throws
 * from module-level side effects, async callbacks, and promise rejections that
 * never pass through React's ErrorBoundary (the boundary only catches render /
 * lifecycle errors).
 *
 * On a production/TestFlight build there is no Metro red box, so an uncaught
 * error otherwise surfaces only as an opaque `RCTExceptionsManager reportFatal`
 * with no JS context. Here we log the full name/message/stack first, THEN chain
 * to the platform's previous handler so crash-reporting behaviour is unchanged —
 * the next build's device log (Xcode Console / `adb logcat`) will name the actual
 * failing module and line instead of just "fatal exception at startup".
 */
type RNErrorUtils = {
  getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

const errorUtils = (globalThis as { ErrorUtils?: RNErrorUtils }).ErrorUtils;
if (errorUtils) {
  const previousHandler = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    const e = error as { name?: string; message?: string; stack?: string } | undefined;
    console.error(
      `[GLOBAL${isFatal ? ' FATAL' : ''}] ${e?.name ?? 'Error'}: ${e?.message ?? String(error)}\n${e?.stack ?? '(no stack)'}`,
    );
    // Preserve default behaviour (in-app error screen in dev, native crash report
    // in prod) so nothing is silently masked — we only added a readable log first.
    previousHandler?.(error, isFatal);
  });
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
