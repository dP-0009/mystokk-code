import { Platform, type ViewStyle } from 'react-native';

/**
 * Apply a style block only on web; native receives `{}`.
 *
 * react-native-web understands a handful of CSS properties that RN's
 * `ViewStyle` type doesn't model (`position: 'sticky' | 'fixed'`, `overflowY`,
 * viewport units like `'100vh'`). This helper lets us spread those into a
 * StyleSheet object while keeping the rest of the codebase type-clean — the
 * cast is contained here instead of scattered `@ts-expect-error`s.
 */
export function webOnly(style: Record<string, unknown>): ViewStyle {
  return (Platform.OS === 'web' ? style : {}) as ViewStyle;
}
