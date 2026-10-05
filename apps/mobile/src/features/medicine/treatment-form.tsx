import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Chip, Field, Message } from '@/features/doctor/ui';
import { medicineDirectory } from '@/features/medicine/directory';
import { MedicinePicker } from '@/features/medicine/medicine-picker';
import type { MedicationInput, TreatmentInput } from '@/features/medicine/repository';
import { toLocalDateKey, type Treatment } from '@/features/medicine/schedule';
import { display, palette, themedStyles, useScheme, wobble } from '@/ui/palette';

type DraftMedication = { key: string; id?: string; name: string; strength: string; form: string; dose: string; times: string[]; instructions: string };

const frequencies: { label: string; times: string[] }[] = [
  { label: 'Once daily', times: ['08:00'] },
  { label: 'Twice daily', times: ['08:00', '20:00'] },
  { label: '3 times', times: ['08:00', '14:00', '20:00'] },
  { label: '4 times', times: ['07:00', '12:00', '17:00', '22:00'] },
];
const timeChoices = ['06:00', '07:00', '08:00', '09:00', '12:00', '14:00', '17:00', '18:00', '20:00', '21:00', '22:00'];
const durations: { label: string; days: number | null }[] = [
  { label: 'No end date', days: null }, { label: '7 days', days: 7 }, { label: '14 days', days: 14 }, { label: '1 month', days: 30 }, { label: '3 months', days: 90 },
];

let counter = 0;
const nextKey = () => `m${++counter}`;
const blank = (name = '', form = ''): DraftMedication => ({ key: nextKey(), name, strength: '', form, dose: '', times: ['08:00'], instructions: '' });

const addDays = (key: string, days: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return toLocalDateKey(new Date(y, m - 1, d + days - 1));
};

type Props = {
  initial?: Treatment;
  presetMedicine?: string;
  heading?: string;
  submitLabel: string;
  prescribe?: boolean;
  onSubmit: (input: TreatmentInput) => Promise<void>;
};

export function TreatmentForm({ initial, presetMedicine, submitLabel, prescribe = false, onSubmit }: Props) {
  useScheme();
  const startKey = initial?.starts_on ?? toLocalDateKey(new Date());
  const preset = presetMedicine ? medicineDirectory.find((m) => m.name === presetMedicine) : undefined;
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [endsOn, setEndsOn] = useState<string | null>(initial?.ends_on ?? null);
  const [meds, setMeds] = useState<DraftMedication[]>(initial?.medications.length
    ? initial.medications.map((m) => ({ key: nextKey(), id: m.id, name: m.name, strength: m.strength ?? '', form: m.form ?? '', dose: m.dose ?? '', times: m.times, instructions: m.instructions ?? '' }))
    : presetMedicine ? [blank(presetMedicine, preset?.forms[0] ?? '')] : []);
  const [pickerFor, setPickerFor] = useState<string | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (key: string, patch: Partial<DraftMedication>) => setMeds((cur) => cur.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  const toggleTime = (key: string, time: string) => setMeds((cur) => cur.map((m) => {
    if (m.key !== key) return m;
    const times = m.times.includes(time) ? m.times.filter((t) => t !== time) : [...m.times, time].sort();
    return { ...m, times: times.length ? times : m.times };
  }));

  const submit = async () => {
    setError('');
    if (!name.trim()) { setError('Give this treatment a name.'); return; }
    if (!meds.length) { setError('Add at least one medicine.'); return; }
    setBusy(true);
    try {
      const medications: MedicationInput[] = meds.map((m) => ({ id: m.id, name: m.name, strength: m.strength, form: m.form, dose: m.dose, times: m.times, instructions: m.instructions }));
      await onSubmit({ id: initial?.id, name, notes, startsOn: startKey, endsOn, medications });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  };

  const activeDuration = durations.find((d) => (d.days === null ? endsOn === null : endsOn === addDays(startKey, d.days)));

  return (
    <View>
      <Field label={prescribe ? 'Treatment name (shown to the patient)' : 'Treatment name'} maxLength={80} onChangeText={setName} placeholder={prescribe ? 'For example: TRT, Hypertension plan' : 'For example: Diabetes plan, Antibiotic course'} value={name} />

      <Text style={styles.label}>Duration</Text>
      <View style={styles.wrap}>
        {durations.map((d) => <Chip key={d.label} label={d.label} selected={activeDuration === d} onPress={() => setEndsOn(d.days === null ? null : addDays(startKey, d.days))} />)}
      </View>
      {endsOn && !activeDuration ? <Text style={styles.meta}>Ends on {endsOn}</Text> : null}

      <Text style={styles.section}>Medicines</Text>
      {meds.map((m) => (
        <View key={m.key} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{m.name || 'Medicine'}</Text>
            <Trash2 accessibilityLabel={`Remove ${m.name}`} color={palette.coral} onPress={() => setMeds((cur) => cur.filter((x) => x.key !== m.key))} size={18} />
          </View>
          <Button label="Change medicine" onPress={() => setPickerFor(m.key)} tone="secondary" />
          <Field label="Strength" onChangeText={(v) => update(m.key, { strength: v })} maxLength={40} placeholder="For example: 500 mg" value={m.strength} />
          <Field label="Dose each time" onChangeText={(v) => update(m.key, { dose: v })} maxLength={60} placeholder="For example: 1 tablet" value={m.dose} />
          <Text style={styles.label}>How often</Text>
          <View style={styles.wrap}>
            {frequencies.map((f) => <Chip key={f.label} label={f.label} selected={f.times.join() === m.times.join()} onPress={() => update(m.key, { times: f.times })} />)}
          </View>
          <Text style={styles.label}>Times of day</Text>
          <View style={styles.wrap}>
            {timeChoices.map((t) => <Chip key={t} label={t} selected={m.times.includes(t)} onPress={() => toggleTime(m.key, t)} />)}
          </View>
          <Field label="Instructions (optional)" maxLength={200} onChangeText={(v) => update(m.key, { instructions: v })} placeholder="For example: with food" value={m.instructions} />
        </View>
      ))}
      <Button label={meds.length ? 'Add another medicine' : 'Choose a medicine'} onPress={() => setPickerFor('new')} tone="secondary" />
      <Field label="Notes (optional)" maxLength={500} multiline onChangeText={setNotes} placeholder={prescribe ? 'Guidance for the patient' : 'Anything you want to remember'} value={notes} />

      {prescribe ? <Message kind="info">The patient will see this under Treatments, marked as prescribed by you. They can pause or stop it, and they log their own doses.</Message> : <Message kind="info">Dose reminders are not sent yet. Open Treatments to log what you take.</Message>}
      {error ? <Message kind="error">{error}</Message> : null}
      <Button busy={busy} label={submitLabel} onPress={() => void submit()} />

      <MedicinePicker
        onClose={() => setPickerFor(null)}
        onPick={(picked) => {
          const form = 'forms' in picked ? picked.forms[0] : '';
          if (pickerFor === 'new') setMeds((cur) => [...cur, blank(picked.name, form)]);
          else if (pickerFor) update(pickerFor, { name: picked.name, form });
        }}
        visible={pickerFor !== null}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  label: { color: palette.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, marginBottom: 6, marginTop: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { color: palette.muted, fontSize: 12, marginTop: 6 },
  section: { ...display, color: palette.ink, fontSize: 19, marginTop: 24 },
  card: { ...wobble, backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, marginBottom: 12, marginTop: 12, padding: 14 },
  cardHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { ...display, color: palette.ink, fontSize: 18 },
}));
