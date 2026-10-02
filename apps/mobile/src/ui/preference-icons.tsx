import { Globe2, Moon, Sun } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocale, type AppLocale } from '@/platform/locale/locale-provider';
import { useThemeMode } from '@/platform/theme/theme-provider';
import { palette, themedStyles } from '@/ui/palette';

const localeOrder: AppLocale[] = ['en', 'fr', 'ar'];
const localeNames: Record<AppLocale, string> = { en: 'English', fr: 'Français', ar: 'العربية' };

export function PreferenceIcons({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { locale, setLocale } = useLocale();
  const { scheme, setMode } = useThemeMode();
  const color = tone === 'dark' ? '#E7ECE9' : palette.ink;
  const nextLocale = localeOrder[(localeOrder.indexOf(locale) + 1) % localeOrder.length];
  const nextScheme = scheme === 'dark' ? 'light' : 'dark';

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityHint={`Switches to ${localeNames[nextLocale]}`}
        accessibilityLabel={`Language: ${localeNames[locale]}`}
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
