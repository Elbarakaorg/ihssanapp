import { useRouter, type Href } from 'expo-router';
import { Activity, BookOpenText, ChevronRight, Compass, Footprints, Globe2, HeartHandshake, House, type LucideIcon, LogIn, LogOut, Moon, Newspaper, Share2, Sun, UserRound, UsersRound, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-provider';
import { getCurrentUserProfile } from '@/features/profile/profile-repository';
import { type AppLocale, useLocale } from '@/platform/locale/locale-provider';
import { useThemeMode } from '@/platform/theme/theme-provider';
import { palette } from '@/ui/palette';

type NavItem = { label: string; href: Href; icon: LucideIcon; clinicianOnly?: boolean };

const navItems: NavItem[] = [
  { href: '/', icon: House, label: 'Home' },
  { href: '/health', icon: Activity, label: 'Health tracking' },
  { href: '/discover', icon: Compass, label: 'Discover care' },
  { href: '/give', icon: HeartHandshake, label: 'Give' },
  { href: '/profile', icon: UserRound, label: 'Medical profile' },
  { href: '/my-patients', icon: UsersRound, label: 'My patients', clinicianOnly: true },
  { href: '/activity', icon: Footprints, label: 'Steps & activity' },
  { href: '/articles', icon: BookOpenText, label: 'Articles' },
  { href: '/blogs', icon: Newspaper, label: 'Blogs' },
];

const languageOptions: { code: AppLocale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'ar', label: 'AR' },
];

export function RightDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session, signOut } = useAuth();
  const { locale, setLocale } = useLocale();
  const { scheme, setMode } = useThemeMode();
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
      await Share.share({ message: 'Track your health with Ihssan — a clearer view of your health record.' });
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
            <Text style={styles.title}>Menu</Text>
            <Pressable accessibilityLabel="Close menu" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <X color={palette.ink} size={20} />
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" onPress={() => go(session ? '/account' : '/auth')} style={styles.accountCard}>
            <View style={styles.avatar}><UserRound color={palette.forest} size={22} /></View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountName}>{session ? (profileName || 'Your account') : 'Sign in to Ihssan'}</Text>
              <Text numberOfLines={1} style={styles.accountMeta}>{session ? session.identity.email : 'Access your health record'}</Text>
            </View>
            <ChevronRight color={palette.muted} size={18} />
          </Pressable>

          <Text style={styles.sectionLabel}>NAVIGATE</Text>
          <View style={styles.navList}>
            {navItems.filter((item) => !item.clinicianOnly || profileType === 'clinician').map((item) => {
              const Icon = item.icon;
              return (
                <Pressable accessibilityRole="button" key={item.label} onPress={() => go(item.href)} style={styles.navRow}>
                  <Icon color={palette.forest} size={18} strokeWidth={1.9} />
                  <Text style={styles.navLabel}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>PREFERENCES</Text>
          <View style={styles.prefRow}>
            <View style={styles.prefLabelGroup}><Globe2 color={palette.forest} size={18} /><Text style={styles.prefLabel}>Language</Text></View>
            <View style={styles.chipRow}>
              {languageOptions.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  key={option.code}
                  onPress={() => setLocale(option.code)}
                  style={[styles.chip, locale === option.code && styles.chipActive]}>
                  <Text style={[styles.chipText, locale === option.code && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.prefRow}>
            <View style={styles.prefLabelGroup}>
              {scheme === 'dark' ? <Moon color={palette.forest} size={18} /> : <Sun color={palette.forest} size={18} />}
              <Text style={styles.prefLabel}>Appearance</Text>
            </View>
            <View style={styles.chipRow}>
              <Pressable accessibilityRole="button" onPress={() => setMode('light')} style={[styles.chip, scheme === 'light' && styles.chipActive]}>
                <Text style={[styles.chipText, scheme === 'light' && styles.chipTextActive]}>Light</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setMode('dark')} style={[styles.chip, scheme === 'dark' && styles.chipActive]}>
                <Text style={[styles.chipText, scheme === 'dark' && styles.chipTextActive]}>Dark</Text>
              </Pressable>
            </View>
          </View>

          <Pressable accessibilityRole="button" onPress={() => void shareApp()} style={styles.actionRow}>
            <Share2 color={palette.forest} size={18} strokeWidth={1.9} />
            <Text style={styles.actionLabel}>Share with friends</Text>
          </Pressable>

          {session ? (
            <Pressable accessibilityRole="button" onPress={() => { onClose(); void signOut(); }} style={[styles.actionRow, styles.signOutRow]}>
              <LogOut color="#A83B28" size={18} strokeWidth={1.9} />
              <Text style={[styles.actionLabel, styles.signOutLabel]}>Sign out</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => go('/auth')} style={styles.actionRow}>
              <LogIn color={palette.forest} size={18} strokeWidth={1.9} />
              <Text style={styles.actionLabel}>Sign in</Text>
            </Pressable>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    shadowColor: '#000',
    shadowOffset: { height: 0, width: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
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
    backgroundColor: palette.paper,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  accountCard: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    padding: 13,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 21,
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
    color: palette.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  navList: {
    marginBottom: 20,
  },
  navRow: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 12,
    minHeight: 42,
    paddingHorizontal: 6,
  },
  navLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  prefRow: {
    marginBottom: 14,
  },
  prefLabelGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  prefLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderRadius: 9,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: palette.forest,
  },
  chipText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: palette.white,
  },
  actionRow: {
    alignItems: 'center',
    borderTopColor: palette.line,
    borderTopWidth: 1,
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
    color: '#A83B28',
  },
});
