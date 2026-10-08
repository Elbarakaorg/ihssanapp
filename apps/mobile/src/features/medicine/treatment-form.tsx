import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Chip, Field, Message } from '@/features/doctor/ui';
import { medicineDirectory } from '@/features/medicine/directory';
import { MedicinePicker } from '@/features/medicine/medicine-picker';
import type { MedicationInput, TreatmentInput } from '@/features/medicine/repository';
import { doseUnits, formatAmount, toLocalDateKey, weekdayNames, type DurationUnit, type Frequency, type Treatment } from '@/features/medicine/schedule';
import { display, palette, themedStyles, useScheme, wobble, glassSurface } from '@/ui/palette';

type DurationChoice = DurationUnit | 'ongoing';
type DraftMedication = {
  key: string; id?: string; name: string; strength: string; form: string;
  amount: string; unit: string; frequency: Frequency; intervalDays: string; weekdays: number[]; times: string[];
  durationValue: string; durationUnit: DurationChoice; maxDaily: string; minHours: string; instructions: string;
};

const frequencyChoices: { label: string; value: Frequency }[] = [
  { label: 'Every day', value: 'daily' }, { label: 'Every few days', value: 'interval' }, { label: 'Certain weekdays', value: 'weekly' }, { label: 'Only as needed', value: 'as_needed' },
];
const dailyPresets: { label: string; times: string[] }[] = [
  { label: 'Once', times: ['08:00'] },
  { label: 'Twice', times: ['08:00', '20:00'] },
  { label: '3 times', times: ['08:00', '14:00', '20:00'] },
  { label: '4 times', times: ['07:00', '12:00', '17:00', '22:00'] },
];
const timeChoices = ['06:00', '07:00', '08:00', '09:00', '12:00', '14:00', '17:00', '18:00', '20:00', '21:00', '22:00'];
const durationChoices: { label: string; value: DurationChoice }[] = [
  { label: 'Days', value: 'days' }, { label: 'Weeks', value: 'weeks' }, { label: 'Months', value: 'months' }, { label: 'Ongoing', value: 'ongoing' },
];
const durationQuick: { label: string; value: string; unit: DurationChoice }[] = [
  { label: '7 days', value: '7', unit: 'days' }, { label: '14 days', value: '14', unit: 'days' }, { label: '1 month', value: '1', unit: 'months' }, { label: '3 months', value: '3', unit: 'months' },
];

let counter = 0;
const nextKey = () => `m${++counter}`;
const blank = (name = '', form = ''): DraftMedication => ({
  key: nextKey(), name, strength: '', form, amount: '1', unit: unitForForm(form), frequency: 'daily', intervalDays: '', weekdays: [], times: ['08:00'],
  durationValue: '', durationUnit: 'ongoing', maxDaily: '', minHours: '', instructions: '',
});

function unitForForm(form: string) {
  const f = form.toLowerCase();
  return doseUnits.find((u) => f.includes(u.toLowerCase())) ?? (f.includes('syrup') || f.includes('suspension') || f.includes('solution') ? 'ml' : f.includes('inhaler') ? 'puff' : 'tablet');
}

const num = (v: string) => Number.parseFloat(v.replace(',', '.'));

function toInput(m: DraftMedication): MedicationInput | string {
  const label = m.name || 'a medicine';
  const amount = num(m.amount);
  if (!(amount > 0)) return `Enter how much ${label} to take each time.`;
  const input: MedicationInput = { id: m.id, name: m.name, strength: m.strength, form: m.form, amount, unit: m.unit, frequency: m.frequency, times: m.times, instructions: m.instructions };
  if (m.frequency === 'interval') {
    const days = Number.parseInt(m.intervalDays, 10);
    if (!(days >= 2 && days <= 365)) return `${label}: choose how many days apart each dose is (2 to 365).`;
    input.intervalDays = days;
  }
  if (m.frequency === 'weekly') {
    if (!m.weekdays.length) return `${label}: choose at least one weekday.`;
    input.weekdays = m.weekdays;
  }
  if (m.frequency === 'as_needed') {
    const max = num(m.maxDaily);
    if (!(max >= amount)) return `${label}: set a maximum per day of at least one dose (${formatAmount(amount, m.unit)}).`;
    input.maxDailyAmount = max;
    if (m.minHours.trim()) {
      const hours = Number.parseInt(m.minHours, 10);
      if (!(hours >= 1 && hours <= 24)) return `${label}: hours between doses must be 1 to 24.`;
      input.minIntervalHours = hours;
    }
  } else if (!m.times.length) return `${label}: choose at least one time of day.`;
  if (m.durationUnit !== 'ongoing') {
    const value = Number.parseInt(m.durationValue, 10);
    if (!(value >= 1)) return `${label}: enter for how long to take it, or choose Ongoing.`;
    input.durationValue = value;
    input.durationUnit = m.durationUnit;
  }
  return input;
}

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
  const [meds, setMeds] = useState<DraftMedication[]>(initial?.medications.length
    ? initial.medications.map((m) => ({
      key: nextKey(), id: m.id, name: m.name, strength: m.strength ?? '', form: m.form ?? '', amount: String(m.amount), unit: m.unit, frequency: m.frequency,
      intervalDays: m.interval_days ? String(m.interval_days) : '', weekdays: m.weekdays ?? [], times: m.times.length ? m.times : ['08:00'],
      durationValue: m.duration_value ? String(m.duration_value) : '', durationUnit: m.duration_unit ?? 'ongoing',
      maxDaily: m.max_daily_amount ? String(m.max_daily_amount) : '', minHours: m.min_interval_hours ? String(m.min_interval_hours) : '', instructions: m.instructions ?? '',
    }))
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
  const toggleWeekday = (key: string, day: number) => setMeds((cur) => cur.map((m) => (m.key !== key ? m : { ...m, weekdays: m.weekdays.includes(day) ? m.weekdays.filter((d) => d !== day) : [...m.weekdays, day].sort() })));

  const submit = async () => {
    setError('');
    if (!name.trim()) { setError('Give this treatment a name.'); return; }
    if (!meds.length) { setError('Add at least one medicine.'); return; }
    const medications: MedicationInput[] = [];
    for (const m of meds) {
      const parsed = toInput(m);
      if (typeof parsed === 'string') { setError(parsed); return; }
      medications.push(parsed);
    }
    setBusy(true);
    try {
      await onSubmit({ id: initial?.id, name, notes, startsOn: startKey, medications });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  };

  return (
    <View>
      <Field label={prescribe ? 'Treatment name (shown to the patient)' : 'Treatment name'} maxLength={80} onChangeText={setName} placeholder={prescribe ? 'For example: TRT, Hypertension plan' : 'For example: Diabetes plan, Antibiotic course'} value={name} />

      <Text style={styles.section}>Medicines</Text>
      {meds.map((m) => (
        <View key={m.key} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{m.name || 'Medicine'}</Text>
            <Trash2 accessibilityLabel={`Remove ${m.name}`} color={palette.coral} onPress={() => setMeds((cur) => cur.filter((x) => x.key !== m.key))} size={18} />
          </View>
          <Button label="Change medicine" onPress={() => setPickerFor(m.key)} tone="secondary" />
          <Field label="Strength on the box (optional)" onChangeText={(v) => update(m.key, { strength: v })} maxLength={40} placeholder="For example: 1000 IU" value={m.strength} />

          <Text style={styles.step}>1 · How much each time</Text>
          <Field keyboardType="decimal-pad" label="Amount" onChangeText={(v) => update(m.key, { amount: v })} maxLength={7} placeholder="1" value={m.amount} />
          <View style={styles.wrap}>{doseUnits.map((u) => <Chip key={u} label={u} selected={m.unit === u} onPress={() => update(m.key, { unit: u })} />)}</View>

          <Text style={styles.step}>2 · How often</Text>
          <View style={styles.wrap}>
            {frequencyChoices.map((f) => <Chip key={f.value} label={f.label} selected={m.frequency === f.value} onPress={() => update(m.key, { frequency: f.value })} />)}
          </View>
          {m.frequency === 'daily' ? (
            <>
              <Text style={styles.label}>Times a day</Text>
              <View style={styles.wrap}>{dailyPresets.map((f) => <Chip key={f.label} label={f.label} selected={f.times.join() === m.times.join()} onPress={() => update(m.key, { times: f.times })} />)}</View>
            </>
          ) : null}
          {m.frequency === 'interval' ? <Field keyboardType="number-pad" label="Every how many days" maxLength={3} onChangeText={(v) => update(m.key, { intervalDays: v.replace(/\D/g, '') })} placeholder="For example: 15" value={m.intervalDays} /> : null}
          {m.frequency === 'weekly' ? (
            <>
              <Text style={styles.label}>On which days</Text>
              <View style={styles.wrap}>{weekdayNames.map((d, i) => <Chip key={d} label={d} selected={m.weekdays.includes(i)} onPress={() => toggleWeekday(m.key, i)} />)}</View>
            </>
          ) : null}
          {m.frequency !== 'as_needed' ? (
            <>
              <Text style={styles.label}>{m.frequency === 'daily' ? 'Times of day' : 'Time of day'}</Text>
              <View style={styles.wrap}>{timeChoices.map((t) => <Chip key={t} label={t} selected={m.times.includes(t)} onPress={() => toggleTime(m.key, t)} />)}</View>
            </>
          ) : (
            <>
              <Field keyboardType="decimal-pad" label={`Maximum per day (${m.unit})`} onChangeText={(v) => update(m.key, { maxDaily: v })} maxLength={7} placeholder={`For example: ${num(m.amount) > 0 ? num(m.amount) * 3 : 3}`} value={m.maxDaily} />
              <Field keyboardType="number-pad" label="Hours between doses (optional)" onChangeText={(v) => update(m.key, { minHours: v.replace(/\D/g, '') })} maxLength={2} placeholder="For example: 6" value={m.minHours} />
              <Text style={styles.meta}>Taken only when needed. The app will stop you logging more than the maximum.</Text>
            </>
          )}

          <Text style={styles.step}>3 · For how long</Text>
          <View style={styles.wrap}>{durationQuick.map((q) => <Chip key={q.label} label={q.label} selected={m.durationValue === q.value && m.durationUnit === q.unit} onPress={() => update(m.key, { durationValue: q.value, durationUnit: q.unit })} />)}</View>
          {m.durationUnit !== 'ongoing' ? <Field keyboardType="number-pad" label="Length" maxLength={4} onChangeText={(v) => update(m.key, { durationValue: v.replace(/\D/g, '') })} placeholder="For example: 3" value={m.durationValue} /> : null}
          <View style={styles.wrap}>{durationChoices.map((d) => <Chip key={d.value} label={d.label} selected={m.durationUnit === d.value} onPress={() => update(m.key, { durationUnit: d.value })} />)}</View>

          <Field label="Comment (optional)" maxLength={200} onChangeText={(v) => update(m.key, { instructions: v })} placeholder="For example: after food, with milk" value={m.instructions} />
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
  step: { ...display, color: palette.forest, fontSize: 15, marginTop: 16 },
  label: { color: palette.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, marginBottom: 6, marginTop: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { color: palette.muted, fontSize: 12, marginTop: 6 },
  section: { ...display, color: palette.ink, fontSize: 19, marginTop: 24 },
  card: { ...wobble, ...glassSurface(), borderWidth: 1, marginBottom: 12, marginTop: 12, padding: 14 },
  cardHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { ...display, color: palette.ink, fontSize: 18 },
}));
