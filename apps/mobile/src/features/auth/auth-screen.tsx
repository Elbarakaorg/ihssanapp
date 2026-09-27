import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from './auth-provider';
import type { ProfileType } from './auth-contract';
import { normalizeEmailConfirmationToken, validateAuthForm, type AuthMode } from './auth-validation';
import { Page, PreviewNotice } from '@/ui/patient-ui';
import { palette } from '@/ui/palette';

export default function AuthScreen() {
  const router = useRouter();
  const { isConfigured, isReady, session, signIn, signOut, signUp, confirmSignup, resendSignupConfirmation } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
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
        router.back();
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
        router.back();
        return;
      }

      await signIn(validation.email, password);
      router.back();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed. Please try again.');
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

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPendingSignupEmail(null);
    setConfirmationToken('');
    setError('');
    setNotice('');
  };

  return (
    <Page>
      <Stack.Screen options={{ title: 'Ihssan account' }} />
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft color={palette.ink} size={19} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
      <PreviewNotice />

      {session ? (
        <View style={styles.signedIn}>
          <View style={styles.successIcon}><ShieldCheck color={palette.forest} size={23} /></View>
          <Text style={styles.title}>You're signed in</Text>
          <Text style={styles.description}>{session.identity.email ?? 'Account'}</Text>
          <Text style={styles.supporting}>This development session is connected to Supabase Auth. Health records are not connected yet.</Text>
          <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void signOut()} style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>Sign out</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
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
            <View style={styles.loadingRow}><ActivityIndicator color={palette.forest} /><Text style={styles.loadingText}>Restoring session</Text></View>
          ) : null}

          {!pendingSignupEmail && mode === 'sign-up' ? (
            <>
              <Text style={styles.fieldLabel}>Account type</Text>
              <View style={styles.profileTypeRow}>
                {(['patient', 'caregiver', 'clinician'] as ProfileType[]).map((type) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: profileType === type }}
                    key={type}
                    onPress={() => setProfileType(type)}
                    style={[styles.profileTypeOption, profileType === type && styles.profileTypeOptionSelected]}>
                    <Text style={[styles.profileTypeText, profileType === type && styles.profileTypeTextSelected]}>{type === 'patient' ? 'Patient' : type === 'caregiver' ? 'Caregiver' : 'Clinician'}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Display name</Text>
              <TextInput
                accessibilityLabel="Display name"
                autoCapitalize="words"
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor="#8A958E"
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
            placeholderTextColor="#8A958E"
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
                placeholderTextColor="#8A958E"
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
                placeholderTextColor="#8A958E"
                style={styles.input}
                value={confirmationToken}
              />
              <Pressable accessibilityRole="button" onPress={() => void handleResendConfirmation()} style={styles.resendButton}>
                <Text style={styles.resendText}>Resend code</Text>
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
                {adultConfirmed ? <Check color={palette.white} size={14} strokeWidth={2.5} /> : null}
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
            {submitting ? <ActivityIndicator color={palette.white} /> : <Text style={styles.primaryLabel}>{pendingSignupEmail ? 'Confirm account' : mode === 'sign-up' ? 'Create account' : 'Sign in'}</Text>}
          </Pressable>

          {!pendingSignupEmail ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => changeMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
              style={styles.modeButton}>
              <Text style={styles.modeText}>{mode === 'sign-up' ? 'Already have an account? Sign in' : 'Need an account? Create one'}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 17,
    minHeight: 36,
  },
  backLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  eyebrow: {
    color: palette.coral,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 3,
  },
  title: {
    color: palette.ink,
    fontFamily: 'Georgia',
    fontSize: 31,
    lineHeight: 38,
  },
  description: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    maxWidth: 470,
  },
  fieldLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
    marginTop: 18,
  },
  profileTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  profileTypeOption: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  profileTypeOptionSelected: {
    backgroundColor: palette.leaf,
    borderColor: palette.forest,
  },
  profileTypeText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  profileTypeTextSelected: {
    color: palette.forest,
  },
  input: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 7,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    minHeight: 49,
    paddingHorizontal: 14,
  },
  adultRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginTop: 17,
    minHeight: 40,
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 4,
    borderWidth: 1,
    height: 21,
    justifyContent: 'center',
    width: 21,
  },
  checkboxChecked: {
    backgroundColor: palette.forest,
    borderColor: palette.forest,
  },
  adultText: {
    color: palette.ink,
    fontSize: 13,
  },
  resendButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 6,
  },
  resendText: {
    color: palette.forest,
    fontSize: 12,
    fontWeight: '600',
  },
  error: {
    color: '#A83B28',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  notice: {
    backgroundColor: '#E8F0E6',
    borderRadius: 6,
    color: palette.forest,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    padding: 12,
  },
  messageBox: {
    backgroundColor: '#F3E8D9',
    borderRadius: 6,
    marginTop: 18,
    padding: 12,
  },
  messageText: {
    color: '#765331',
    fontSize: 12,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.forest,
    borderRadius: 7,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 48,
    minWidth: 146,
    paddingHorizontal: 18,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  primaryLabel: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },
  modeButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: 15,
    minHeight: 40,
  },
  modeText: {
    color: palette.forest,
    fontSize: 13,
    fontWeight: '600',
  },
  signedIn: {
    alignItems: 'flex-start',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 480,
    padding: 21,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginBottom: 16,
    width: 44,
  },
  supporting: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 19,
    minHeight: 44,
    paddingHorizontal: 15,
  },
  secondaryLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    marginTop: 18,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 12,
  },
});