import type { AuthRepository, AuthSession, ProfileType } from '@/features/auth/auth-contract';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabaseClient } from '@/platform/supabase/client';

if (Platform.OS !== 'web') WebBrowser.maybeCompleteAuthSession();

function toAuthSession(session: { user: { id: string; email?: string } } | null): AuthSession | null {
  if (!session) return null;

  return {
    identity: {
      id: session.user.id,
      email: session.user.email ?? null,
    },
  };
}

export const supabaseAuthRepository: AuthRepository = {
  isConfigured: supabaseClient !== null,

  async getSession() {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return toAuthSession(data.session);
  },

  subscribe(onSessionChanged) {
    if (!supabaseClient) return () => undefined;

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      onSessionChanged(toAuthSession(session));
    });

    return () => data.subscription.unsubscribe();
  },

  async signInWithGoogle(profileType?: ProfileType) {
    if (!supabaseClient) throw new Error('Authentication is not configured.');

    const redirectTo = Linking.createURL('auth/callback', {
      queryParams: {
        ...(profileType ? { profile_type: profileType } : {}),
      },
    });

    if (Platform.OS === 'web') {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) throw error;
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error('Google sign-in could not be started.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') throw new Error('Google sign-in was cancelled.');

    const { queryParams } = Linking.parse(result.url);
    const callbackError = queryParams?.error_description ?? queryParams?.error;
    if (typeof callbackError === 'string') throw new Error(callbackError);

    const code = queryParams?.code;
    if (typeof code !== 'string') throw new Error('Google sign-in returned an invalid response.');

    const { error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  },

  async signInWithApple(profileType?: ProfileType) {
    if (!supabaseClient) throw new Error('Authentication is not configured.');
    if (Platform.OS !== 'ios') throw new Error('Sign in with Apple is available on iOS.');
    const AppleAuthentication = await import('expo-apple-authentication');
    let credential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new Error('Sign in with Apple was cancelled.');
      throw error;
    }
    if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
    const { error } = await supabaseClient.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
    if (error) throw error;

    // Apple only shares the name on the first sign-in, so keep it while we have it.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    await supabaseClient.auth.updateUser({ data: { ...(name ? { full_name: name } : {}), ...(profileType ? { profile_type: profileType } : {}) } }).catch(() => undefined);
  },

  async signIn(email, password) {
    if (!supabaseClient) throw new Error('Authentication is not configured.');

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async signUp(email, password, displayName, profileType: ProfileType) {
    if (!supabaseClient) throw new Error('Authentication is not configured.');

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, profile_type: profileType },
      },
    });

    if (error) throw error;

    return { emailConfirmationRequired: data.session === null };
  },

  async confirmSignup(email, token) {
    if (!supabaseClient) throw new Error('Authentication is not configured.');

    const { error } = await supabaseClient.auth.verifyOtp({ email, token, type: 'signup' });
    if (error) throw error;
  },

  async resendSignupConfirmation(email) {
    if (!supabaseClient) throw new Error('Authentication is not configured.');

    const { error } = await supabaseClient.auth.resend({ type: 'signup', email });
    if (error) throw error;
  },

  async updatePassword(password) {
    if (!supabaseClient) throw new Error('Authentication is not configured.');

    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw error;
  },

  async signOut() {
    if (!supabaseClient) return;

    const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
    if (error) throw error;
  },
};