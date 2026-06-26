import { Share } from 'react-native';

/**
 * Copy/share helpers. The project doesn't depend on expo-clipboard, so copying
 * uses the web Clipboard API when available (dev web preview) and otherwise
 * falls back to the native share sheet — which is the expected "share a link"
 * gesture on a phone anyway.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } })
      .navigator;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to share
  }
  return false;
}

export async function shareText(text: string): Promise<void> {
  try {
    await Share.share({ message: text });
  } catch {
    // user dismissed the sheet
  }
}
