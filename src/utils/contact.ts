import { Alert, Linking } from 'react-native';

/** Reduce to digits only — what wa.me and tel: both accept. */
function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

async function open(url: string, missing: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open', missing);
  }
}

/** Open WhatsApp chat with the given number (https://wa.me/<digits>). */
export function openWhatsApp(mobile: string | null): void {
  if (!mobile?.trim()) {
    Alert.alert('No number', 'This vendor has no mobile number on file.');
    return;
  }
  void open(`https://wa.me/${normalizePhone(mobile)}`, 'WhatsApp is not available.');
}

/** Start a phone call (tel:<number>). */
export function openCall(mobile: string | null): void {
  if (!mobile?.trim()) {
    Alert.alert('No number', 'This vendor has no mobile number on file.');
    return;
  }
  void open(`tel:${normalizePhone(mobile)}`, 'Calling is not available on this device.');
}

/** Open the mail composer (mailto:). */
export function openEmail(email: string | null): void {
  if (!email?.trim()) {
    Alert.alert('No email', 'This vendor has no email on file.');
    return;
  }
  void open(`mailto:${email.trim()}`, 'No mail app is available.');
}
