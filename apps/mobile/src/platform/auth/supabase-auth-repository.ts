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

    const popup = Platform.OS === 'web'
      ? window.open('about:blank', 'ihssan-google-auth', 'popup,width=480,height=680')
      : null;
    if (Platform.OS === 'web' && !popup) throw new Error('Allow pop-ups to continue with Google.');
    const oauthChannelId = Platform.OS === 'web' ? crypto.randomUUID() : undefined;

    const redirectTo = Linking.createURL('auth/callback', {
      queryParams: {
        ...(profileType ? { profile_type: profileType } : {}),
        ...(oauthChannelId ? { oauth_channel: oauthChannelId } : {}),
      },
    });
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      popup?.close();
      throw error;
    }
    if (!data.url) {
      popup?.close();
      throw new Error('Google sign-in could not be started.');
    }

    if (Platform.OS === 'web' && popup) {
      const code = await new Promise<string>((resolve, reject) => {
        const channel = new BroadcastChannel(`ihssan-google-auth-${oauthChannelId}`);
        const finishWith = (data: { source?: string; code?: string; error?: string }) => {
          if (data.source !== 'ihssan-google-auth') return;
          finish(() => data.error
            ? reject(new Error(data.error))
            : data.code
              ? resolve(data.code)
              : reject(new Error('Google sign-in returned an invalid response.')));
        };
        const onMessage = (event: MessageEvent<{ source?: string; code?: string; error?: string }>) => {
          if (event.origin !== window.location.origin || event.source !== popup || event.data?.source !== 'ihssan-google-auth') return;
          finishWith(event.data);
        };
        channel.onmessage = (event: MessageEvent<{ source?: string; code?: string; error?: string }>) => finishWith(event.data);
        const closeCheck = window.setInterval(() => {
          if (popup.closed) finish(() => reject(new Error('Google sign-in was cancelled.')));
        }, 500);
        const timeout = window.setTimeout(() => {
          popup.close();
          finish(() => reject(new Error('Google sign-in timed out. Please try again.')));
        }, 120000);
        const finish = (callback: () => void) => {
          window.removeEventListener('message', onMessage);
          window.clearInterval(closeCheck);
          window.clearTimeout(timeout);
          channel.close();
          callback();
        };

        window.addEventListener('message', onMessage);
        popup.location.href = data.url;
      });
      const { error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      return;
    }

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