import type { FirebaseError } from 'firebase/app';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Your email or password is incorrect. Please try again.',
  'auth/invalid-email': 'That email address doesn\'t look right. Please check and try again.',
  'auth/user-not-found': 'No account found with that email. You can create a new account instead.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact support if this is unexpected.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/weak-password': 'Your password is too weak. Try at least 8 characters with a mix of letters and numbers.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
};

export function getFriendlyAuthErrorMessage(error: unknown): string {
  const defaultMessage = 'Something went wrong while processing your request. Please try again.';

  if (!error) return defaultMessage;

  const maybeFirebaseError = error as Partial<FirebaseError> & { code?: string; message?: string };

  if (maybeFirebaseError.code && AUTH_ERROR_MESSAGES[maybeFirebaseError.code]) {
    return AUTH_ERROR_MESSAGES[maybeFirebaseError.code];
  }

  if (typeof maybeFirebaseError.message === 'string') {
    // Fallback: strip raw Firebase code patterns like "(auth/invalid-credential)"
    const cleaned = maybeFirebaseError.message.replace(/\(auth\/[^(]+\)/, '').trim();
    if (cleaned) return cleaned;
  }

  return defaultMessage;
}

