import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ProfileType } from '@/features/auth/auth-contract';
import { completeAccountSetup } from '@/features/profile/profile-repository';
import { Page, PreviewNotice } from '@/ui/patient-ui';
import { palette } from '@/ui/palette';

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
    <Page>
      <Stack.Screen options={{ title: 'Complete your profile' }} />
      <PreviewNotice />
      <Text style={styles.eyebrow}>ONE-TIME SETUP</Text>
      <Text style={styles.title}>Complete your profile</Text>
      <Text style={styles.description}>Choose how you’ll use Ihssan. Clinician accounts require separate verification before accessing patient records.</Text>

      <Text style={styles.fieldLabel}>Profile type</Text>
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
            {profileType === type ? <Check color={palette.forest} size={16} /> : null}
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

      {profileType === 'clinician' ? (
        <Text style={styles.clinicianNotice}>Your account will remain pending until Ihssan verifies your professional credentials.</Text>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void handleContinue()} style={[styles.button, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color={palette.white} /> : <Text style={styles.buttonText}>Continue</Text>}
      </Pressable>
    </Page>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: palette.coral,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: palette.ink,
    fontFamily: 'Georgia',
    fontSize: 30,
    lineHeight: 37,
  },
  description: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 480,
  },
  fieldLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 22,
  },
  profileTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  profileType: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 45,
    minWidth: 118,
    paddingHorizontal: 14,
  },
  profileTypeSelected: {
    backgroundColor: palette.leaf,
    borderColor: palette.leafDeep,
  },
  profileTypeText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
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
  clinicianNotice: {
    backgroundColor: '#EDF2EA',
    borderRadius: 6,
    color: palette.forest,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    padding: 12,
  },
  error: {
    color: '#A83B28',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.forest,
    borderRadius: 7,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 47,
    minWidth: 122,
    paddingHorizontal: 18,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
  },
});