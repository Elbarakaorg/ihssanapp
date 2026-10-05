import { type Href, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { display, palette, themedStyles, useScheme, wobble } from '@/ui/palette';

export function BackLink({ label, href }: { label: string; href: Href }) {
  useScheme();
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace(href))} style={styles.back}>
      <ArrowLeft color={palette.ink} size={18} /><Text style={styles.backLabel}>{label}</Text>
    </Pressable>
  );
}

export function Button({ label, onPress, busy, disabled, tone = 'primary' }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; tone?: 'primary' | 'secondary' | 'danger' }) {
  useScheme();
  const off = busy || disabled;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!off }} disabled={off} onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed, styles.button, tone === 'secondary' && styles.buttonSecondary, tone === 'danger' && styles.buttonDanger, off && styles.off]}>
      {busy ? <ActivityIndicator color={tone === 'primary' ? palette.white : palette.forest} /> : <Text style={[styles.buttonLabel, tone !== 'primary' && (tone === 'danger' ? styles.dangerLabel : styles.secondaryLabel)]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  useScheme();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={palette.muted} {...props} value={props.value ?? ''} style={[styles.input, props.multiline && styles.multiline]} />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  useScheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress} style={({ pressed }) => [pressed && styles.pressed, styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{label}</Text>
    </Pressable>
  );
}

export function Message({ kind, children }: { kind: 'error' | 'ok' | 'info'; children: ReactNode }) {
  useScheme();
  return <Text accessibilityRole={kind === 'error' ? 'alert' : undefined} style={[styles.message, kind === 'error' && styles.messageError, kind === 'ok' && styles.messageOk]}>{children}</Text>;
}

export const formatDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Casablanca' });
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Casablanca' });
export const toDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(date);
  return parts;
};

export const doctorStyles = themedStyles(() => StyleSheet.create({
  title: { ...display, color: palette.ink, fontSize: 30, lineHeight: 36 },
  body: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  card: { ...wobble, backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, gap: 6, marginTop: 12, padding: 14 },
  cardTitle: { ...display, color: palette.ink, fontSize: 18 },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  section: { ...display, color: palette.ink, fontSize: 19, marginTop: 24 },
}));

const styles = themedStyles(() => StyleSheet.create({
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 16, minHeight: 42 },
  backLabel: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  button: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 12, justifyContent: 'center', marginTop: 12, minHeight: 48, paddingHorizontal: 16 },
  buttonSecondary: { backgroundColor: 'transparent', borderColor: palette.line, borderWidth: 1 },
  buttonDanger: { backgroundColor: 'transparent', borderColor: '#A4502F', borderWidth: 1 },
  buttonLabel: { color: palette.white, fontSize: 14, fontWeight: '700' },
  secondaryLabel: { color: palette.forest },
  dangerLabel: { color: '#A4502F' },
  off: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  field: { marginTop: 14 },
  fieldLabel: { color: palette.muted, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: palette.white, borderColor: palette.line, borderRadius: 12, borderWidth: 1, color: palette.ink, fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  chip: { borderColor: palette.line, borderRadius: 18, borderWidth: 1, minHeight: 38, justifyContent: 'center', paddingHorizontal: 14 },
  chipOn: { backgroundColor: palette.forest, borderColor: palette.forest },
  chipLabel: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  chipLabelOn: { color: palette.white },
  message: { backgroundColor: palette.leaf, borderRadius: 10, color: palette.ink, fontSize: 12, lineHeight: 18, marginTop: 14, padding: 12 },
  messageError: { backgroundColor: '#F3E1D6', color: '#8A4A2C' },
  messageOk: { backgroundColor: palette.leaf, color: palette.forest },
}));
