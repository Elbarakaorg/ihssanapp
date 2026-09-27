import type { ProfileType } from './auth-contract';

export type AuthMode = 'sign-in' | 'sign-up';

export type AuthFormInput = {
  mode: AuthMode;
  email: string;
  password: string;
  displayName: string;
  adultConfirmed: boolean;
  profileType?: ProfileType;
};

export type AuthValidation =
  | { valid: true; email: string }
  | { valid: false; error: string };

export function validateAuthForm(input: AuthFormInput): AuthValidation {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Enter a valid email address.' };
  }

  if (input.password.length < 8) {
    return { valid: false, error: 'Use a password with at least 8 characters.' };
  }

  if (input.mode === 'sign-up') {
    const displayName = input.displayName.trim();
    if (displayName.length < 2 || displayName.length > 80) {
      return { valid: false, error: 'Enter a name between 2 and 80 characters.' };
    }

    const profileType = input.profileType ?? 'patient';
    if (!['patient', 'caregiver', 'clinician'].includes(profileType)) {
      return { valid: false, error: 'Choose a profile type to continue.' };
    }

    if (!input.adultConfirmed) {
      return { valid: false, error: 'Confirm that you are 18 or older to create an account.' };
    }
  }

  return { valid: true, email };
}

export function normalizeEmailConfirmationToken(token: string): string | null {
  const normalizedToken = token.replace(/[\s-]/g, '');
  return /^\d{4,12}$/.test(normalizedToken) ? normalizedToken : null;
}