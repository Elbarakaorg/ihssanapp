import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Check, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from './auth-provider';
import type { ProfileType } from './auth-contract';
import { normalizeEmailConfirmationToken, validateAuthForm, type AuthMode } from './auth-validation';
import { getCurrentUserProfile } from '@/features/profile/profile-repository';
import { DarkAuthShell, ink } from './dark-auth-shell';
import { themedStyles, useScheme } from '@/ui/palette';

export default function AuthScreen() {
  useScheme();
  const router = useRouter();
  const { mode: requestedMode } = useLocalSearchParams<{ mode?: string }>();
  const { isConfigured, isReady, session, signIn, signInWithGoogle, signOut, signUp, confirmSignup, resendSignupConfirmation } = useAuth();
  const [mode, setMode] = useState<AuthMode>(requestedMode === 'sign-up' ? 'sign-up' : 'sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [profileType, setProfileType] = useState<ProfileType>('patient');
  const [pendingSignupEmail, setPendingSignupEmail] = useState<string | null>(null);
  const [confirmationToken, setConfirmationToken] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const continueToAccount = async (expectedType: ProfileType) => {
    const profile = await getCurrentUserProfile();
    if (profile.profile_type !== expectedType) {
      await signOut();
      throw new Error(`This account is registered as a ${profile.profile_type}. Choose ${profile.profile_type === 'clinician' ? 'Clinician' : 'Patient'} to sign in.`);
    }
    if (!profile.setup_completed_at) {
      router.replace({ pathname: '/auth/complete-profile', params: { profile_type: profile.profile_type } });
      return;
    }
    router.replace(profile.profile_type === 'clinician' ? '/my-patients' : '/(tabs)');
  };

  const handleSubmit = async () => {
    const validation = validateAuthForm({ mode, email, password, displayName, adultConfirmed, profileType });
    if (!validation.valid) {
      setError(validation.error);
      setNotice('');
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      if (pendingSignupEmail) {
        const normalizedToken = normalizeEmailConfirmationToken(confirmationToken);
        if (!normalizedToken) {
          setError('Enter the 6-digit confirmation code from your email.');
          return;
        }

        await confirmSignup(pendingSignupEmail, normalizedToken);
        await signIn(pendingSignupEmail, password);
        setPendingSignupEmail(null);
        setConfirmationToken('');
        await continueToAccount(profileType);
        return;
      }

      if (mode === 'sign-up') {
        const result = await signUp(validation.email, password, displayName.trim(), profileType);
        if (result.emailConfirmationRequired) {
          setPendingSignupEmail(validation.email);
          setConfirmationToken('');
          setNotice('We sent a confirmation code to your email. Enter it below to finish creating your account.');
          return;
        }

        await signIn(validation.email, password);
        await continueToAccount(profileType);
        return;
      }

      await signIn(validation.email, password);
      await continueToAccount(profileType);
    } catch (authError) {
      if (mode === 'sign-up' && isGatewayTimeout(authError)) {
        setPendingSignupEmail(validation.email);
        setConfirmationToken('');
        setError('');
        setNotice('Sign-up timed out, so we cannot confirm whether your account was created. Check your email for a code; resend it if needed, or return and retry sign-up.');
      } else {
        setError(authError instanceof Error ? authError.message : 'Authentication failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!pendingSignupEmail) return;

    try {
      setError('');
      setNotice('');
      await resendSignupConfirmation(pendingSignupEmail);
      setNotice('A new confirmation code has been sent to your email.');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'We could not resend the confirmation code.');
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    setError('');
    try {
      await signInWithGoogle(profileType);
      router.replace({
        pathname: '/auth/callback',
        params: { profile_type: profileType },
      });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Google sign-in could not be started.');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPendingSignupEmail(null);
    setConfirmationToken('');
    setError('');
    setNotice('');
  };

  return (
    <DarkAuthShell>
      <Stack.Screen options={{ headerShown: false }} />
      {session ? (
        <View style={styles.signedIn}>
          <View style={styles.successIcon}><ShieldCheck color={ink.accent} size={23} /></View>
          <Text style={styles.title}>You're signed in</Text>
          <Text style={styles.description}>{session.identity.email ?? 'Account'}</Text>
          <Text style={styles.supporting}>Your saved results stay in your account unless you choose to share them with a clinician.</Text>
          <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void signOut()} style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>Sign out</Text>
          </Pressable>
        </View>
      ) : (
        <>
                    <Text style={styles.title}>{pendingSignupEmail ? 'Verify your email' : mode === 'sign-up' ? 'Create your account' : 'Sign in'}</Text>
          <Text style={styles.description}>
            {pendingSignupEmail
              ? `We sent a verification code to ${pendingSignupEmail}. Enter it below to finish creating your account.`
              : mode === 'sign-up' ? 'Create your account to start managing your health profile.' : 'Sign in to continue to your Ihssan account.'}
          </Text>

          {!isConfigured ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>Supabase is not configured. Check the local development environment settings.</Text>
            </View>
          ) : null}

          {!isReady ? (
            <View style={styles.loadingRow}><ActivityIndicator color={ink.accent} /><Text style={styles.loadingText}>Restoring session</Text></View>
          ) : null}

          {!pendingSignupEmail ? (
            <>
              <View style={styles.profileTypeRow}>
                {(['patient', 'clinician'] as ProfileType[]).map((type) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: profileType === type }}
                    key={type}
                    onPress={() => setProfileType(type)}
                    style={[styles.profileTypeOption, profileType === type && styles.profileTypeOptionSelected]}>
                    <Text style={[styles.profileTypeText, profileType === type && styles.profileTypeTextSelected]}>{type === 'patient' ? 'Patient' : 'Clinician'}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {!pendingSignupEmail && mode === 'sign-up' ? (
            <>
              <Text style={styles.fieldLabel}>Display name</Text>
              <TextInput
                accessibilityLabel="Display name"
                autoCapitalize="words"
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={ink.faint}
                style={styles.input}
                value={displayName}
              />
            </>
          ) : null}

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor={ink.faint}
            style={styles.input}
            textContentType="emailAddress"
            value={email}
          />

          {!pendingSignupEmail ? (
            <>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={ink.faint}
                secureTextEntry
                style={styles.input}
                textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
                value={password}
              />
            </>
          ) : null}

          {pendingSignupEmail ? (
            <>
              <Text style={styles.fieldLabel}>Confirmation code</Text>
              <TextInput
                accessibilityLabel="Confirmation code"
                autoCapitalize="none"
                autoComplete="one-time-code"
                keyboardType="number-pad"
                onChangeText={setConfirmationToken}
                placeholder="123456"
                placeholderTextColor={ink.faint}
                style={[styles.input, styles.codeInput]}
                value={confirmationToken}
                maxLength={8}
              />
              <Pressable accessibilityRole="button" onPress={() => void handleResendConfirmation()} style={styles.resendButton}>
                <Text style={styles.resendText}>Resend code</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setPendingSignupEmail(null); setConfirmationToken(''); setNotice(''); setError(''); }} style={styles.resendButton}>
                <Text style={styles.resendText}>Back and retry sign-up</Text>
              </Pressable>
            </>
          ) : null}

          {!pendingSignupEmail && mode === 'sign-up' ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: adultConfirmed }}
              onPress={() => setAdultConfirmed((confirmed) => !confirmed)}
              style={styles.adultRow}>
              <View style={[styles.checkbox, adultConfirmed && styles.checkboxChecked]}>
                {adultConfirmed ? <Check color={ink.bg} size={14} strokeWidth={2.5} /> : null}
              </View>
              <Text style={styles.adultText}>I confirm that I am 18 years old or older.</Text>
            </Pressable>
          ) : null}

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={submitting || !isConfigured}
            onPress={() => void handleSubmit()}
            style={[styles.primaryButton, (submitting || !isConfigured) && styles.buttonDisabled]}>
            {submitting ? <ActivityIndicator color={ink.bg} /> : <Text style={styles.primaryLabel}>{pendingSignupEmail ? 'Confirm account' : mode === 'sign-up' ? 'Create account' : 'Sign in'}</Text>}
          </Pressable>

          {!pendingSignupEmail ? (
            <>
              <View style={styles.separator}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorLabel}>or</Text>
                <View style={styles.separatorLine} />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={googleSubmitting || !isConfigured}
                onPress={() => void handleGoogleSignIn()}
                style={[styles.googleButton, (googleSubmitting || !isConfigured) && styles.buttonDisabled]}>
                {googleSubmitting ? <ActivityIndicator color={ink.text} /> : <>
                  <Text style={styles.googleMark}>G</Text>
                  <Text style={styles.googleLabel}>Continue with Google</Text>
                </>}
              </Pressable>
            </>
          ) : null}

          {!pendingSignupEmail ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => changeMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
              style={styles.modeButton}>
              <Text style={styles.modeText}>{mode === 'sign-up' ? 'Already have an account? Sign in' : 'New here? Create an account'}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </DarkAuthShell>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  title: { color: ink.text, fontSize: 38, fontWeight: '300', letterSpacing: -1, lineHeight: 44 },
  description: { color: ink.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
  fieldLabel: { color: ink.muted, fontSize: 12, fontWeight: '500', marginBottom: 8, marginTop: 22 },
  profileTypeRow: {
    backgroundColor: ink.panel,
    borderColor: ink.edge,
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 28,
    padding: 3,
  },
  profileTypeOption: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 9, flex: 1, justifyContent: 'center', minHeight: 40 },
  profileTypeOptionSelected: { backgroundColor: 'rgba(63,214,162,0.16)' },
  profileTypeText: { color: ink.muted, fontSize: 14, fontWeight: '500' },
  profileTypeTextSelected: { color: ink.accent },
  input: {
    backgroundColor: ink.panel,
    borderBottomColor: ink.edge,
    borderBottomWidth: 1,
    borderColor: ink.edge,
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    color: ink.text,
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  codeInput: { fontSize: 26, fontVariant: ['tabular-nums'], fontWeight: '300', letterSpacing: 8, textAlign: 'center' },
  adultRow: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 12, marginTop: 20, minHeight: 44 },
  checkbox: {
    alignItems: 'center',
    borderColor: ink.edge,
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxChecked: { backgroundColor: ink.accent, borderColor: ink.accent },
  adultText: { color: ink.muted, flex: 1, fontSize: 13 },
  resendButton: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center' },
  resendText: { color: ink.accent, fontSize: 13, fontWeight: '500' },
  error: { color: ink.error, fontSize: 13, lineHeight: 19, marginTop: 16 },
  notice: {
    backgroundColor: 'rgba(63,214,162,0.1)',
    borderCurve: 'continuous',
    borderRadius: 12,
    color: ink.accent,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 16,
    overflow: 'hidden',
    padding: 14,
  },
  messageBox: { backgroundColor: 'rgba(255,190,110,0.12)', borderCurve: 'continuous', borderRadius: 12, marginTop: 20, padding: 14 },
  messageText: { color: '#F0C48A', fontSize: 13, lineHeight: 19 },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: ink.accent,
    borderCurve: 'continuous',
    borderRadius: 12,
    boxShadow: '0 0 28px rgba(63,214,162,0.35)',
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 54,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryLabel: { color: ink.bg, fontSize: 16, fontWeight: '600' },
  modeButton: { alignItems: 'center', alignSelf: 'center', justifyContent: 'center', marginTop: 18, minHeight: 44 },
  modeText: { color: ink.muted, fontSize: 14 },
  separator: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
  separatorLine: { backgroundColor: ink.edge, flex: 1, height: StyleSheet.hairlineWidth },
  separatorLabel: { color: ink.faint, fontSize: 12 },
  googleButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderColor: ink.edge,
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 52,
  },
  googleMark: { color: ink.text, fontSize: 16, fontWeight: '700' },
  googleLabel: { color: ink.text, fontSize: 15, fontWeight: '500' },
  signedIn: {
    alignItems: 'flex-start',
    backgroundColor: ink.panel,
    borderColor: ink.edge,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    padding: 22,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(63,214,162,0.14)',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginBottom: 16,
    width: 44,
  },
  supporting: { color: ink.muted, fontSize: 14, lineHeight: 20, marginTop: 12 },
  secondaryButton: {
    alignItems: 'center',
    borderColor: ink.edge,
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  secondaryLabel: { color: ink.text, fontSize: 14, fontWeight: '500' },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 9, marginTop: 18 },
  loadingText: { color: ink.muted, fontSize: 13 },
}));

function isGatewayTimeout(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const status = 'status' in error ? error.status : undefined;
  const message = 'message' in error ? String(error.message) : '';
  return status === 504 || /gateway timeout|\b504\b|timed out/i.test(message);
}