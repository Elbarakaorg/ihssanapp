import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { getCurrentUserProfile } from '@/features/profile/profile-repository';
import { supabaseClient } from '@/platform/supabase/client';
import { Page, PageHeading, PreviewNotice } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';
import { Loading } from '@/ui/loading';

export default function AuthCallbackScreen() {
  useScheme();
  const router = useRouter();
  const { profile_type: requestedProfileType, oauth_channel: oauthChannelId, code, error: authError, error_description: authErrorDescription } = useLocalSearchParams<{ profile_type?: string; oauth_channel?: string; code?: string; error?: string; error_description?: string }>();
  const { isReady, session, signOut } = useAuth();
  const [error, setError] = useState('');
  const isOAuthPopup = Platform.OS === 'web' && typeof window !== 'undefined' && Boolean(window.opener || oauthChannelId) && Boolean(code || authError);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const providerError = authErrorDescription ?? authError;
    const hasHashCredentials = /access_token|refresh_token|provider_token|error/.test(window.location.hash);
    if (code || authError || authErrorDescription || oauthChannelId || hasHashCredentials) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.hash = '';
      cleanUrl.searchParams.delete('code');
      cleanUrl.searchParams.delete('error');
      cleanUrl.searchParams.delete('error_description');
      cleanUrl.searchParams.delete('oauth_channel');
      window.history.replaceState(window.history.state, '', cleanUrl.toString());
    }
    if ((window.opener || oauthChannelId) && (code || providerError)) {
      const response = {
        source: 'ihssan-google-auth',
        code: typeof code === 'string' ? code : undefined,
        error: typeof providerError === 'string' ? providerError : undefined,
      };
      if (window.opener) window.opener.postMessage(response, window.location.origin);
      if (oauthChannelId && typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(`ihssan-google-auth-${oauthChannelId}`);
        channel.postMessage(response);
        channel.close();
      }
      window.close();
      return;
    }
    if (typeof providerError === 'string') {
      setError(providerError);
      return;
    }
    if (typeof code === 'string' && supabaseClient) {
      void supabaseClient.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) setError(exchangeError.message);
      });
    }
  }, [authError, authErrorDescription, code, oauthChannelId]);

  useEffect(() => {
    if (isOAuthPopup || !isReady || !session) return;

    let active = true;

    void getCurrentUserProfile().then(async (profile) => {
      if (!active) return;
      if (profile.setup_completed_at) {
        const requestedType = requestedProfileType === 'clinician' || requestedProfileType === 'patient' ? requestedProfileType : null;
        if (requestedType && profile.profile_type !== requestedType) {
          await signOut();
          if (active) setError(`This account is registered as a ${profile.profile_type}. Choose ${profile.profile_type === 'clinician' ? 'Clinician' : 'Patient'} to sign in.`);
          return;
        }
        router.replace(profile.profile_type === 'clinician' ? '/my-patients' : '/(tabs)');
        return;
      }

      const profileType = requestedProfileType === 'clinician' ? 'clinician' : 'patient';
      router.replace({ pathname: '/auth/complete-profile', params: { profile_type: profileType } });
    }).catch((profileError) => {
      if (active) setError(profileError instanceof Error ? profileError.message : 'We could not load your profile.');
    });

    return () => {
      active = false;
    };
  }, [isOAuthPopup, isReady, requestedProfileType, router, session, signOut]);

  return (
    <Page>
      <Stack.Screen options={{ title: 'Completing sign in' }} />
      <PreviewNotice />
      <PageHeading eyebrow="Secure sign-in" title="Finishing your sign-in">
        We’re connecting your Google account to your Ihssan profile.
      </PageHeading>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : <Loading label="Signing you in" state="connecting" />}
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  error: {
    color: palette.dangerText,
    fontSize: 13,
    lineHeight: 19,
  },
}));