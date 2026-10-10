import { useRouter, type Href } from 'expo-router';
import { Activity, CalendarCheck, CalendarClock, Stethoscope, BookOpenText, ChevronRight, Compass, Footprints, HeartHandshake, House, type LucideIcon, LogIn, LogOut, MapPinned, Newspaper, Share2, UserRound, UsersRound, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-provider';
import { getCurrentUserProfile } from '@/features/profile/profile-repository';
import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy, type DonationCopyKey } from '@/platform/locale/donations';
import { palette, themedStyles, useScheme } from '@/ui/palette';

type NavItem = { labelKey: DonationCopyKey; href: Href; icon: LucideIcon; clinicianOnly?: boolean; signedInOnly?: boolean };

const navItems: NavItem[] = [
  { href: '/', icon: House, labelKey: 'nav.home' },
  { href: '/health', icon: Activity, labelKey: 'nav.healthTracking' },
  { href: '/discover', icon: Compass, labelKey: 'nav.discoverCare' },
  { href: '/give', icon: HeartHandshake, labelKey: 'nav.give' },
  { href: '/collect' as Href, icon: HeartHandshake, labelKey: 'nav.myGivingCases', signedInOnly: true },
  { href: '/profile', icon: UserRound, labelKey: 'nav.medicalProfile' },
  { href: '/doctors', icon: Stethoscope, labelKey: 'nav.findDoctor' },
  { href: '/appointments', icon: CalendarCheck, labelKey: 'nav.appointments' },
  { href: '/doctor-profile', icon: UserRound, labelKey: 'nav.doctorProfile', clinicianOnly: true },
  { href: '/schedule', icon: CalendarClock, labelKey: 'nav.mySchedule', clinicianOnly: true },
  { href: '/my-patients', icon: UsersRound, labelKey: 'nav.myPatients', clinicianOnly: true },
  { href: '/practice-locations', icon: MapPinned, labelKey: 'nav.practiceLocations', clinicianOnly: true },
  { href: '/activity', icon: Footprints, labelKey: 'nav.activity' },
  { href: '/articles', icon: BookOpenText, labelKey: 'nav.articles' },
  { href: '/blogs', icon: Newspaper, labelKey: 'nav.blogs' },
];


export function RightDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  useScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session, signOut } = useAuth();
  const { locale } = useLocale();
  const [profileName, setProfileName] = useState('');
  const [profileType, setProfileType] = useState<'patient' | 'clinician'>('patient');
  const [mounted, setMounted] = useState(visible);
  const [interactive, setInteractive] = useState(false);
  const panelWidth = Math.min(340, width * 0.86);
  const translateX = useRef(new Animated.Value(panelWidth)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!session) {
      setProfileName('');
      return;
    }
    let active = true;
    void getCurrentUserProfile().then((profile) => {
      if (active) {
        setProfileName(profile.display_name);
        setProfileType(profile.profile_type);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateX, { duration: 300, easing: Easing.out(Easing.cubic), toValue: 0, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { duration: 300, toValue: 1, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setInteractive(true);
      });
    } else {
      setInteractive(false);
      Animated.parallel([
        Animated.timing(translateX, { duration: 220, easing: Easing.in(Easing.cubic), toValue: panelWidth, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { duration: 220, toValue: 0, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, panelWidth, translateX, backdropOpacity]);

  if (!mounted) return null;

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  const shareApp = async () => {
    try {
      await Share.share({ message: donationCopy(locale, 'nav.trackShare') });
    } catch {
      // sharing was dismissed or unavailable on this device; nothing to recover
    }
  };

  return (
    <View pointerEvents={interactive ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
      <Pressable accessibilityLabel="Close menu" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </Pressable>
      <Animated.View style={[styles.panel, { paddingBottom: insets.bottom + 20, paddingTop: insets.top + 14, transform: [{ translateX }], width: panelWidth }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{donationCopy(locale, 'nav.menu')}</Text>
            <Pressable accessibilityLabel="Close menu" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <X color={palette.ink} size={20} />
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" onPress={() => go(session ? '/account' : '/auth')} style={styles.accountCard}>
            <View style={styles.avatar}><UserRound color={palette.forest} size={22} /></View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountName}>{session ? (profileName || donationCopy(locale, 'nav.yourAccount')) : donationCopy(locale, 'nav.signInToIhssan')}</Text>
              <Text numberOfLines={1} style={styles.accountMeta}>{session ? session.identity.email : donationCopy(locale, 'nav.healthRecord')}</Text>
            </View>
            <ChevronRight color={palette.muted} size={18} />
          </Pressable>

          <Text style={styles.sectionLabel}>{donationCopy(locale, 'nav.navigate')}</Text>
          <View style={styles.navList}>
            {navItems.filter((item) => (!item.clinicianOnly || profileType === 'clinician') && (!item.signedInOnly || !!session)).map((item) => {
              const Icon = item.icon;
              return (
                <Pressable accessibilityRole="button" key={item.labelKey} onPress={() => go(item.href)} style={styles.navRow}>
                  <Icon color={palette.forest} size={18} strokeWidth={1.9} />
                  <Text style={styles.navLabel}>{donationCopy(locale, item.labelKey)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable accessibilityRole="button" onPress={() => void shareApp()} style={styles.actionRow}>
            <Share2 color={palette.forest} size={18} strokeWidth={1.9} />
            <Text style={styles.actionLabel}>{donationCopy(locale, 'nav.shareFriends')}</Text>
          </Pressable>

          {session ? (
            <Pressable accessibilityRole="button" onPress={() => { onClose(); void signOut(); }} style={[styles.actionRow, styles.signOutRow]}>
              <LogOut color={palette.coral} size={18} strokeWidth={1.9} />
              <Text style={[styles.actionLabel, styles.signOutLabel]}>{donationCopy(locale, 'nav.signOut')}</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => go('/auth')} style={styles.actionRow}>
              <LogIn color={palette.forest} size={18} strokeWidth={1.9} />
              <Text style={styles.actionLabel}>{donationCopy(locale, 'nav.signIn')}</Text>
            </Pressable>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(12, 20, 16, 0.42)',
    flex: 1,
  },
  panel: {
    backgroundColor: palette.white,
    bottom: 0,
    paddingHorizontal: 18,
    position: 'absolute',
    right: 0,
    borderLeftColor: palette.line,
    borderLeftWidth: StyleSheet.hairlineWidth,
    top: 0,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderCurve: 'continuous',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  accountCard: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderCurve: 'continuous',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  accountCopy: {
    flex: 1,
  },
  accountName: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  accountMeta: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 2,
  },
  sectionLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  navList: {
    marginBottom: 20,
  },
  navRow: {
    alignItems: 'center',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 12,
    minHeight: 46,
    paddingHorizontal: 6,
  },
  navLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    alignItems: 'center',
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    marginTop: 4,
    paddingTop: 4,
  },
  signOutRow: {
    marginTop: 0,
  },
  actionLabel: {
    color: palette.forest,
    fontSize: 14,
    fontWeight: '700',
  },
  signOutLabel: {
    color: palette.dangerText,
  },
}));
