import { type Href, useRouter } from 'expo-router';
import { Globe2, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { getCurrentUserProfile } from '@/features/profile/profile-repository';
import { Page, PageHeading, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';

const settings = [
  { title: 'Language', detail: 'English · preview', icon: Globe2 },
  { title: 'Account and sign-in', detail: 'Manage your account details and sign-in', icon: UserRound },
  { title: 'Data and privacy', detail: 'Review consent and sharing controls', icon: LockKeyhole },
];

export default function ProfileScreen() {
  useScheme();
  const router = useRouter();
  const { isReady, session, signOut } = useAuth();
  const [profileName, setProfileName] = useState('');
  const [profileType, setProfileType] = useState('Patient');

  useEffect(() => {
    if (!session) {
      setProfileName('');
      setProfileType('Patient');
      return;
    }

    let active = true;

    void getCurrentUserProfile().then((profile) => {
      if (!active) return;
      setProfileName(profile.display_name);
      setProfileType(profile.profile_type === 'clinician' ? 'Clinician' : 'Patient');
    }).catch(() => {
      if (active) {
        setProfileName('');
        setProfileType('Patient');
      }
    });

    return () => {
      active = false;
    };
  }, [session]);

  return (
    <Page>
      <PreviewNotice />
      <PageHeading eyebrow="Your account" title="Profile and privacy">
        Manage your account, language, and who can access your health record.
      </PageHeading>

      <View style={[uiStyles.card, styles.accountCard]}>
        <View style={styles.avatar}><UserRound color={palette.forest} size={22} strokeWidth={1.8} /></View>
        <View style={styles.accountCopy}>
          <Text style={styles.accountTitle}>{session ? profileType : 'Patient account'}</Text>
          <Text style={styles.accountDetail}>{profileName || session?.identity.email || (isReady ? 'Not signed in' : 'Restoring session')}</Text>
        </View>
      </View>
      {session ? (
        <View style={styles.accountActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/account' as Href)} style={styles.authButton}>
            <Text style={styles.authButtonText}>Open your account</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={[styles.authButton, styles.signOutButton]}>
            <Text style={styles.authButtonText}>Sign out</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.accountActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={styles.authButton}>
            <Text style={styles.authButtonText}>Sign in</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={[styles.authButton, styles.secondaryActionButton]}>
            <Text style={styles.authButtonText}>Create account</Text>
          </Pressable>
        </View>
      )}

      <SectionHeading title="Settings" />
      <View style={styles.settingsList}>
        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <View key={item.title} style={[uiStyles.card, styles.settingRow]}>
              <View style={uiStyles.iconTile}><Icon color={palette.forest} size={18} strokeWidth={1.8} /></View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>{item.title}</Text>
                <Text style={styles.settingDetail}>{item.detail}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.privacyNote}>
        <ShieldCheck color={palette.forest} size={18} />
        <Text style={styles.privacyText}>The app is in development. Use only fictional profile data until the live patient workflow is enabled.</Text>
      </View>
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  accountCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  accountCopy: {
    flex: 1,
  },
  accountTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  accountDetail: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  accountActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 13,
  },
  authButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.forest,
    borderCurve: 'continuous',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 15,
  },
  signOutButton: {
    backgroundColor: palette.leaf,
  },
  secondaryActionButton: {
    backgroundColor: palette.leaf,
  },
  authButtonText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
  },
  settingsList: { borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, borderTopWidth: StyleSheet.hairlineWidth, gap: 0 },
  settingRow: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 0,
    paddingVertical: 14,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  settingDetail: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 4,
  },
  privacyNote: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  privacyText: {
    color: palette.muted,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
}));