/**
 * Transient, in-memory holder for an in-progress signup.
 *
 * The account is created only AFTER OTP verification, so the chosen password
 * must survive the Signup → OTP screen hop. We keep it here (module memory,
 * never persisted, never in navigation params) and clear it on success.
 */

interface SignupDraft {
  email: string;
  password: string;
}

let draft: SignupDraft | null = null;

export function setSignupDraft(next: SignupDraft): void {
  draft = next;
}

export function getSignupDraft(): SignupDraft | null {
  return draft;
}

export function clearSignupDraft(): void {
  draft = null;
}
