import { Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { medicineCategories, searchMedicines, type Medicine, type MedicineCategory } from '@/features/medicine/directory';
import { Chip } from '@/features/doctor/ui';
import { display, palette, themedStyles, useScheme, wobble } from '@/ui/palette';

type Props = { visible: boolean; onClose: () => void; onPick: (medicine: Medicine | { name: string; custom: true }) => void };

export function MedicinePicker({ visible, onClose, onPick }: Props) {
  useScheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MedicineCategory | 'All'>('All');
  const results = useMemo(() => searchMedicines(query, category).slice(0, 60), [query, category]);
  const typed = query.trim();
  const exact = results.some((m) => m.name.toLowerCase() === typed.toLowerCase());

  const close = () => { setQuery(''); setCategory('All'); onClose(); };

  return (
    <Modal animationType="slide" onRequestClose={close} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose a medicine</Text>
            <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={close} style={styles.close}><X color={palette.ink} size={20} /></Pressable>
          </View>
          <View style={styles.search}>
            <Search color={palette.muted} size={16} />
            <TextInput accessibilityLabel="Search medicines" autoCapitalize="none" autoCorrect={false} onChangeText={setQuery} placeholder="Search by name or what it treats" placeholderTextColor={palette.muted} style={styles.input} value={query} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipRow}>
            {(['All', ...medicineCategories] as const).map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
          </ScrollView>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
            {typed && !exact ? (
              <Pressable accessibilityRole="button" onPress={() => { onPick({ name: typed, custom: true }); close(); }} style={styles.row}>
                <Text style={styles.name}>Use “{typed}”</Text>
                <Text style={styles.meta}>Not in the directory? Add it by name.</Text>
              </Pressable>
            ) : null}
            {results.map((m) => (
              <Pressable accessibilityRole="button" key={m.name} onPress={() => { onPick(m); close(); }} style={styles.row}>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.meta}>{m.category} · {m.use}</Text>
                <Text style={styles.forms}>{m.forms.join(' · ')}</Text>
              </Pressable>
            ))}
            {!results.length && !typed ? <Text style={styles.meta}>No medicines in this category.</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(20, 17, 14, .5)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.paper, borderTopLeftRadius: 16, borderTopRightRadius: 12, height: '85%', padding: 18 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...display, color: palette.ink, fontSize: 22 },
  close: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  search: { ...wobble, alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, flexDirection: 'row', gap: 8, marginTop: 10, paddingHorizontal: 12 },
  input: { color: palette.ink, flex: 1, fontSize: 15, minHeight: 46 },
  chips: { flexGrow: 0, marginTop: 10 },
  chipRow: { gap: 6, paddingRight: 8 },
  list: { marginTop: 8 },
  row: { borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2, paddingVertical: 12 },
  name: { color: palette.ink, fontSize: 15, fontWeight: '600' },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  forms: { color: palette.forest, fontSize: 11 },
}));
