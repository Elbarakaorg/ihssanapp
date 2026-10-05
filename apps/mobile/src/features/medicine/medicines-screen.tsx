import { type Href, useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackLink, Button, Chip } from '@/features/doctor/ui';
import { medicineCategories, medicineDirectory, searchMedicines, type MedicineCategory } from '@/features/medicine/directory';
import { Page, PageHeading } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme, wobble } from '@/ui/palette';

export default function MedicinesScreen() {
  useScheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MedicineCategory | 'All'>('All');
  const [open, setOpen] = useState<string | null>(null);
  const results = useMemo(() => searchMedicines(query, category), [query, category]);

  return (
    <Page>
      <BackLink href="/" label="Home" />
      <PageHeading eyebrow="Reference" title="Medicine directory">{`${medicineDirectory.length} common medicines by generic name. Add one to a treatment to track your doses.`}</PageHeading>

      <View style={styles.search}>
        <Search color={palette.muted} size={16} />
        <TextInput accessibilityLabel="Search medicines" autoCapitalize="none" autoCorrect={false} onChangeText={setQuery} placeholder="Search by name or what it treats" placeholderTextColor={palette.muted} style={styles.input} value={query} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipRow}>
        {(['All', ...medicineCategories] as const).map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
      </ScrollView>
      <Text style={styles.count}>{results.length} {results.length === 1 ? 'medicine' : 'medicines'}</Text>

      {results.map((m) => {
        const expanded = open === m.name;
        return (
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} key={m.name} onPress={() => setOpen(expanded ? null : m.name)} style={styles.card}>
            <Text style={styles.name}>{m.name}</Text>
            <Text style={styles.meta}>{m.category} · {m.use}</Text>
            {expanded ? (
              <View>
                <Text style={styles.forms}>Common forms: {m.forms.join(', ')}</Text>
                <Text style={styles.meta}>Doses depend on the person. Follow your prescriber’s instructions and the leaflet.</Text>
                <Button label="Add to a treatment" onPress={() => router.push(`/treatments/edit?medicine=${encodeURIComponent(m.name)}` as Href)} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
      {!results.length ? <Text style={styles.meta}>Nothing matches. You can still add any medicine by name when you create a treatment.</Text> : null}
      <Text style={styles.disclaimer}>This directory is general information, not medical advice, and is not a complete list. Ask a doctor or pharmacist about what is right for you.</Text>
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  search: { ...wobble, alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  input: { color: palette.ink, flex: 1, fontSize: 15, minHeight: 48 },
  chips: { flexGrow: 0, marginTop: 12 },
  chipRow: { gap: 6, paddingRight: 8 },
  count: { color: palette.muted, fontSize: 12, marginTop: 12 },
  card: { ...wobble, backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, gap: 4, marginTop: 10, padding: 14 },
  name: { ...display, color: palette.ink, fontSize: 18 },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  forms: { color: palette.forest, fontSize: 12, fontWeight: '600', marginTop: 6 },
  disclaimer: { color: palette.muted, fontSize: 11, fontStyle: 'italic', lineHeight: 16, marginTop: 20 },
}));
