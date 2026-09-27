import { describe, expect, it } from 'vitest';

import { normalizeEmailConfirmationToken, validateAuthForm, type AuthFormInput } from './auth-validation';

const validSignUp: AuthFormInput = {
  mode: 'sign-up',
  email: ' Test.Patient@example.com ',
  password: 'test-only-123',
  displayName: 'Test Patient',
  adultConfirmed: true,
};

describe('validateAuthForm', () => {
  it('normalizes a valid email address', () => {
    expect(validateAuthForm(validSignUp)).toEqual({ valid: true, email: 'test.patient@example.com' });
  });

  it('rejects malformed email addresses', () => {
    expect(validateAuthForm({ ...validSignUp, email: 'not-an-email' })).toMatchObject({ valid: false });
  });

  it('requires at least eight password characters', () => {
    expect(validateAuthForm({ ...validSignUp, password: 'short' })).toMatchObject({
      valid: false,
      error: 'Use a password with at least 8 characters.',
    });
  });

  it('requires adult confirmation for account creation', () => {
    expect(validateAuthForm({ ...validSignUp, adultConfirmed: false })).toMatchObject({
      valid: false,
      error: 'Confirm that you are 18 or older to create an account.',
    });
  });

  it('does not require the signup-only fields when signing in', () => {
    expect(
      validateAuthForm({ ...validSignUp, mode: 'sign-in', displayName: '', adultConfirmed: false }),
    ).toEqual({ valid: true, email: 'test.patient@example.com' });
  });
});

describe('normalizeEmailConfirmationToken', () => {
  it('removes spaces from and accepts a one-time numeric code', () => {
    expect(normalizeEmailConfirmationToken(' 123 456 ')).toBe('123456');
  });

  it('rejects malformed or out-of-length codes', () => {
    expect(normalizeEmailConfirmationToken('12ab56')).toBeNull();
    expect(normalizeEmailConfirmationToken('123')).toBeNull();
  });
});