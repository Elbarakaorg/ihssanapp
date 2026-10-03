import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, LockKeyhole, Save, ShieldCheck, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { getAvatarUrl, getClinicianVerificationStatus, getCurrentUserProfile, type AccountProfile, updateCurrentUserProfile, uploadCurrentUserAvatar } from '@/features/profile/profile-repository';
import { getMyCredentials, type Credentials } from '@/features/doctor/doctor-api';
import { Page, PageHeading, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

export default function AccountScreen() {
  useScheme();
  const router = useRouter();
  const { session, updatePassword } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verification, setVerification] = useState<{ status: string | null; creds: Credentials | null } | null>(null);

  useEffect(() => {
    let active = true;
    if (!session) {
      router.replace('/auth');
      return () => { active = false; };
    }

    void getCurrentUserProfile().then(async (nextProfile) => {
      if (!active) return;
      setProfile(nextProfile);
      setDisplayName(nextProfile.display_name);
      setBio(nextProfile.bio);
      setAvatarUrl(await getAvatarUrl(nextProfile.avatar_path));
      if (nextProfile.profile_type === 'clinician') {
        const [status, creds] = await Promise.all([getClinicianVerificationStatus().catch(() => null), getMyCredentials().catch(() => null)]);
        if (active) setVerification({ status, creds });
      }
    }).catch((profileError) => {
      if (active) setError(profileError instanceof Error ? profileError.message : 'Could not load your account.');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [router, session]);

  const saveProfile = async () => {
    setSavingProfile(true);
    setError('');
    setNotice('');
    try {
      const nextProfile = await updateCurrentUserProfile({ displayName, bio });
      setProfile(nextProfile);
      setDisplayName(nextProfile.display_name);
      setBio(nextProfile.bio);
      setNotice('Profile details saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const choosePhoto = async () => {
    setError('');
    setNotice('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is needed to choose a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      mediaTypes: ['images'],
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    const base64 = asset.base64;
    if (!base64) return;
    if (asset.mimeType && !imageTypes.includes(asset.mimeType)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (base64.length * 0.75 > 2 * 1024 * 1024) {
      setError('That photo is larger than 2 MB. Choose a smaller image.');
      return;
    }
    const extension = asset.mimeType === 'image/png' ? 'png' : asset.mimeType === 'image/webp' ? 'webp' : 'jpg';
    setSavingPhoto(true);
    try {
      const nextProfile = await uploadCurrentUserAvatar({
        base64,
        extension,
        contentType: asset.mimeType ?? 'image/jpeg',
      });
      setProfile(nextProfile);
      setAvatarUrl(await getAvatarUrl(nextProfile.avatar_path));
      setNotice('Profile photo updated.');
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Could not upload your profile photo.');
    } finally {
      setSavingPhoto(false);
    }
  };

  const savePassword = async () => {
    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('The passwords do not match.');
      return;
    }

    setSavingPassword(true);
    setError('');
    setNotice('');
    try {
      await updatePassword(password);
      setPassword('');
      setPasswordConfirmation('');
      setNotice('Your password has been updated.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Could not update your password.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <Page><View style={styles.loading}><ActivityIndicator color={palette.forest} /><Text style={styles.muted}>Loading your account</Text></View></Page>;

  const roleLabel = profile?.profile_type === 'clinician' ? 'Clinician account' : 'Patient account';

  return (
    <Page>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft color={palette.ink} size={19} /><Text style={styles.backLabel}>Profile</Text>
      </Pressable>
      <PreviewNotice />
      <PageHeading eyebrow="Account workspace" title="Your profile">
        Keep your identity, sign-in methods, and public-facing details up to date.
      </PageHeading>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

      <View style={[uiStyles.card, styles.identityCard]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" disabled={savingPhoto} onPress={() => void choosePhoto()} style={styles.avatarButton}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <UserRound color={palette.forest} size={32} />}
          <View style={styles.cameraBadge}>{savingPhoto ? <ActivityIndicator color={palette.white} size="small" /> : <Camera color={palette.white} size={15} />}</View>
        </Pressable>
        <View style={styles.identityCopy}>
          <Text style={styles.identityName}>{profile?.display_name || 'Your account'}</Text>
          <Text style={styles.roleLabel}>{roleLabel}</Text>
          <Text numberOfLines={1} style={styles.email}>{session?.identity.email}</Text>
        </View>
      </View>

      {verification ? (
        <>
          <SectionHeading title="Clinician verification" />
          <View style={[uiStyles.card, styles.formCard]}>
            <Text style={styles.verifyStatus}>{({ verified: 'Verified', pending: 'Pending review', rejected: 'Rejected', suspended: 'Suspended' } as Record<string, string>)[verification.status ?? ''] ?? 'Not submitted'}</Text>
            {verification.creds ? (
              <>
                <Text style={styles.securityDetail}>License: {verification.creds.license_number}</Text>
                <Text style={styles.securityDetail}>Issued by: {verification.creds.issuing_body}</Text>
                <Text style={styles.securityDetail}>Specialty: {verification.creds.specialty} · {verification.creds.city}</Text>
              </>
            ) : <Text style={styles.securityDetail}>No credentials submitted yet.</Text>}
            <Pressable accessibilityRole="button" onPress={() => router.push('/doctor-profile')} style={styles.secondaryButton}>
              <ShieldCheck color={palette.forest} size={17} /><Text style={styles.secondaryLabel}>{verification.creds ? 'Manage doctor profile' : 'Submit credentials'}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <SectionHeading title="Profile details" />
      <View style={[uiStyles.card, styles.formCard]}>
        <Text style={styles.fieldLabel}>Display name</Text>
        <TextInput autoCapitalize="words" maxLength={80} onChangeText={setDisplayName} style={styles.input} value={displayName} />
        <Text style={styles.fieldLabel}>Bio</Text>
        <TextInput accessibilityLabel="Bio" maxLength={500} multiline onChangeText={setBio} placeholder="A short introduction" placeholderTextColor="#8A958E" style={[styles.input, styles.bioInput]} textAlignVertical="top" value={bio} />
        <Text style={styles.characterCount}>{bio.length}/500</Text>
        <Pressable accessibilityRole="button" disabled={savingProfile} onPress={() => void saveProfile()} style={[styles.primaryButton, savingProfile && styles.disabledButton]}>
          {savingProfile ? <ActivityIndicator color={palette.white} /> : <><Save color={palette.white} size={17} /><Text style={styles.primaryLabel}>Save profile</Text></>}
        </Pressable>
      </View>

      <SectionHeading title="Account security" />
      <View style={[uiStyles.card, styles.formCard]}>
        <View style={styles.securityHeading}><LockKeyhole color={palette.forest} size={19} /><View><Text style={styles.securityTitle}>Password</Text><Text style={styles.securityDetail}>Set a password for Google sign-in, or replace your existing password.</Text></View></View>
        <Text style={styles.fieldLabel}>New password</Text>
        <TextInput autoComplete="new-password" onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#8A958E" secureTextEntry style={styles.input} textContentType="newPassword" value={password} />
        <Text style={styles.fieldLabel}>Confirm new password</Text>
        <TextInput autoComplete="new-password" onChangeText={setPasswordConfirmation} placeholder="Repeat your password" placeholderTextColor="#8A958E" secureTextEntry style={styles.input} textContentType="newPassword" value={passwordConfirmation} />
        <Pressable accessibilityRole="button" disabled={savingPassword} onPress={() => void savePassword()} style={[styles.secondaryButton, savingPassword && styles.disabledButton]}>
          {savingPassword ? <ActivityIndicator color={palette.forest} /> : <><ShieldCheck color={palette.forest} size={17} /><Text style={styles.secondaryLabel}>Set or change password</Text></>}
        </Pressable>
      </View>
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 17, minHeight: 42 },
  backLabel: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  loading: { alignItems: 'center', gap: 10, marginTop: 72 },
  muted: { color: palette.muted, fontSize: 13 },
  error: { backgroundColor: '#FCE9E5', borderRadius: 12, color: '#9A3E2A', fontSize: 13, lineHeight: 19, marginBottom: 12, padding: 13 },
  notice: { backgroundColor: palette.leaf, borderRadius: 12, color: palette.forest, fontSize: 13, lineHeight: 19, marginBottom: 12, padding: 13 },
  identityCard: { alignItems: 'center', flexDirection: 'row', gap: 16, padding: 18 },
  avatarButton: { alignItems: 'center', backgroundColor: palette.leaf, borderColor: palette.line, borderRadius: 38, borderWidth: 1, height: 76, justifyContent: 'center', overflow: 'visible', width: 76 },
  avatarImage: { borderRadius: 37, height: 74, width: 74 },
  cameraBadge: { alignItems: 'center', backgroundColor: palette.forest, borderColor: palette.white, borderRadius: 14, borderWidth: 2, bottom: -2, height: 28, justifyContent: 'center', position: 'absolute', right: -3, width: 28 },
  identityCopy: { flex: 1 },
  identityName: { color: palette.ink, fontSize: 18, fontWeight: '700' },
  roleLabel: { color: palette.coral, fontSize: 12, fontWeight: '700', marginTop: 4 },
  email: { color: palette.muted, fontSize: 12, marginTop: 5 },
  formCard: { padding: 18 },
  fieldLabel: { color: palette.ink, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: palette.paper, borderColor: 'transparent', borderRadius: 10, borderWidth: 1, color: palette.ink, fontSize: 15, minHeight: 48, paddingHorizontal: 13, paddingVertical: 10 },
  bioInput: { minHeight: 112 },
  characterCount: { alignSelf: 'flex-end', color: palette.muted, fontSize: 11, marginTop: 5 },
  primaryButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 11, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 20, minHeight: 48, paddingHorizontal: 16 },
  primaryLabel: { color: palette.white, fontSize: 13, fontWeight: '700' },
  securityHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  verifyStatus: { color: palette.forest, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  securityTitle: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  securityDetail: { color: palette.muted, flexShrink: 1, fontSize: 12, lineHeight: 18, marginTop: 3 },
  secondaryButton: { alignItems: 'center', backgroundColor: palette.leaf, borderColor: 'transparent', borderRadius: 11, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 20, minHeight: 48, paddingHorizontal: 16 },
  secondaryLabel: { color: palette.forest, fontSize: 13, fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
}));