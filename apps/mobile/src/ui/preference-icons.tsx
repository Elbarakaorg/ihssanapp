import { Globe2, Moon, Sun } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocale, type AppLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { useThemeMode } from '@/platform/theme/theme-provider';
import { palette, themedStyles } from '@/ui/palette';

const localeOrder: AppLocale[] = ['en', 'fr', 'ar'];
const localeKeys: Record<AppLocale, 'language.english' | 'language.french' | 'language.arabic'> = { en: 'language.english', fr: 'language.french', ar: 'language.arabic' };

export function PreferenceIcons({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { locale, setLocale } = useLocale();
  const { scheme, setMode } = useThemeMode();
  const color = tone === 'dark' ? '#E7ECE9' : palette.ink;
  const nextLocale = localeOrder[(localeOrder.indexOf(locale) + 1) % localeOrder.length];
  const nextScheme = scheme === 'dark' ? 'light' : 'dark';
  const currentName = donationCopy(locale, localeKeys[locale]);
  const nextName = donationCopy(locale, localeKeys[nextLocale]);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityHint={donationCopy(locale, 'language.switchTo', { name: nextName })}
        accessibilityLabel={donationCopy(locale, 'language.current', { name: currentName })}
        accessibilityRole="button"
        hitSlop={4}
        onPress={() => setLocale(nextLocale)}
        style={styles.button}>
        <Globe2 color={color} size={18} strokeWidth={1.8} />
        <Text style={[styles.code, { color }]}>{locale.toUpperCase()}</Text>
      </Pressable>
      <Pressable
        accessibilityHint={`Switches to ${nextScheme} appearance`}
        accessibilityLabel={`Appearance: ${scheme}`}
        accessibilityRole="button"
        hitSlop={4}
        onPress={() => setMode(nextScheme)}
        style={styles.button}>
        {scheme === 'dark' ? <Moon color={color} size={18} strokeWidth={1.8} /> : <Sun color={color} size={18} strokeWidth={1.8} />}
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  button: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
  },
  code: { fontSize: 11, fontVariant: ['tabular-nums'], fontWeight: '600' },
}));
