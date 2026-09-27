import type { AuthRepository, AuthSession, ProfileType } from '@/features/auth/auth-contract';
import { supabaseClient } from '@/platform/supabase/client';

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

  async signOut() {
    if (!supabaseClient) return;

    const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
    if (error) throw error;
  },
};