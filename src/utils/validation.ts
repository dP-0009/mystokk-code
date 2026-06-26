/** Shared form validation constants. */

/** Pragmatic email shape check (full RFC validation happens server-side). */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Minimum password length enforced across signup + reset (matches §3 / Edge fn). */
export const MIN_PASSWORD_LENGTH = 8;
