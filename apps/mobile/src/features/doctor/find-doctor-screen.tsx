import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { type DoctorSummary, searchDoctors } from '@/features/doctor/doctor-api';
import { BackLink, Field, Message, doctorStyles as s } from '@/features/doctor/ui';
import { Page } from '@/ui/patient-ui';
import { useScheme } from '@/ui/palette';

export default function FindDoctorScreen() {
  useScheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<DoctorSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setError('');
      searchDoctors(query)
        .then((result) => { if (active) setRows(result); })
        .catch((e) => { if (active) { setError(e instanceof Error ? e.message : 'Could not search.'); setRows([]); } });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  return (
    <Page>
      <BackLink href="/" label="Home" />
      <Text style={s.title}>Find a doctor</Text>
      <Text style={s.body}>Verified doctors with an approved practice location.</Text>
      <Field label="Name, specialty or city" value={query} onChangeText={setQuery} autoCorrect={false} maxLength={60} />
      {rows === null ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
      {error ? <Message kind="error">{error}</Message> : null}
      {rows?.length === 0 && !error ? <Message kind="info">No doctors found.</Message> : null}
      {rows?.map((d) => (
        <Pressable key={d.clinician_id} accessibilityRole="button" onPress={() => router.push(`/doctors/${d.clinician_id}` as Href)} style={s.card}>
          <Text style={s.cardTitle}>{d.name}</Text>
          {d.headline ? <Text style={s.meta}>{d.headline}</Text> : null}
          <Text style={s.meta}>{[...d.specialties.slice(0, 3), ...d.cities.slice(0, 2)].join(' · ')}</Text>
        </Pressable>
      ))}
    </Page>
  );
}
