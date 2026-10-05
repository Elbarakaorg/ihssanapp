import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ProfileType } from '@/features/auth/auth-contract';
import { completeAccountSetup } from '@/features/profile/profile-repository';
import { display } from '@/ui/palette';
import { DarkAuthShell, ink } from '@/features/auth/dark-auth-shell';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { profile_type: requestedProfileType } = useLocalSearchParams<{ profile_type?: string }>();
  const [profileType, setProfileType] = useState<ProfileType>(requestedProfileType === 'clinician' ? 'clinician' : 'patient');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (displayName.trim().length < 2 || displayName.trim().length > 80) {
      setError('Enter a name between 2 and 80 characters.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await completeAccountSetup(displayName, profileType);
      router.replace(profileType === 'clinician' ? '/my-patients' : '/(tabs)');
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'We could not finish setting up your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DarkAuthShell showBack={false}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <Text style={styles.title}>Complete your profile</Text>
      <Text style={styles.description}>Choose how you’ll use Ihssan. Clinician accounts require separate verification before accessing patient records.</Text>

      <View style={styles.profileTypes}>
        {(['patient', 'clinician'] as const).map((type) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: profileType === type }}
            key={type}
            onPress={() => setProfileType(type)}
            style={[styles.profileType, profileType === type && styles.profileTypeSelected]}>
            <Text style={[styles.profileTypeText, profileType === type && styles.profileTypeTextSelected]}>
              {type === 'patient' ? 'Patient' : 'Clinician'}
            </Text>
          </Pressable>
        ))}
      </View>

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

      {profileType === 'clinician' ? (
        <Text style={styles.clinicianNotice}>Your account will remain pending until Ihssan verifies your professional credentials.</Text>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void handleContinue()} style={[styles.button, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color={ink.bg} /> : <Text style={styles.buttonText}>Continue</Text>}
      </Pressable>
    </DarkAuthShell>
  );
}

const styles = StyleSheet.create({
  title: { ...display, color: ink.text, fontSize: 40, lineHeight: 46 },
  description: { color: ink.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
  fieldLabel: { color: ink.muted, fontSize: 12, fontWeight: '500', marginBottom: 8, marginTop: 22 },
  profileTypes: {
    backgroundColor: ink.panel,
    borderColor: ink.edge,
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 28,
    padding: 3,
  },
  profileType: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 9, flex: 1, justifyContent: 'center', minHeight: 40 },
  profileTypeSelected: { backgroundColor: 'rgba(63,214,162,0.16)' },
  profileTypeText: { color: ink.muted, fontSize: 14, fontWeight: '500' },
  profileTypeTextSelected: { color: ink.accent },
  input: {
    backgroundColor: ink.panel,
    borderColor: ink.edge,
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    color: ink.text,
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  clinicianNotice: {
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
  error: { color: ink.error, fontSize: 13, lineHeight: 19, marginTop: 16 },
  button: {
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
  disabled: { opacity: 0.5 },
  buttonText: { color: ink.bg, fontSize: 16, fontWeight: '600' },
});
