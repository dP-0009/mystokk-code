import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation dialog.
 *
 * `Alert.alert` on react-native-web does not render its buttons or fire their
 * `onPress` callbacks, so any confirm-then-act flow (sign out, delete, etc.)
 * silently does nothing on the web build. This routes web through the native
 * `window.confirm` and keeps the real `Alert` on iOS/Android.
 */
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  const {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onConfirm,
  } = opts;

  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined' && window.confirm(text)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
