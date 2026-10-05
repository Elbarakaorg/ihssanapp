import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { type DoctorLocation, listMyPracticeLocations } from '@/features/discovery/care-api';
import { type ScheduleRule, addScheduleRule, deleteScheduleRule, listMyScheduleRules } from '@/features/doctor/doctor-api';
import { BackLink, Button, Chip, Field, Message, doctorStyles as s } from '@/features/doctor/ui';
import { Page } from '@/ui/patient-ui';
import { useScheme } from '@/ui/palette';
import { Loading } from '@/ui/loading';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const lengths = [15, 20, 30, 45, 60];
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function ScheduleScreen() {
  useScheme();
  const { session } = useAuth();
  const [locations, setLocations] = useState<DoctorLocation[]>([]);
  const [rules, setRules] = useState<ScheduleRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState('');
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('12:00');
  const [slot, setSlot] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [locs, rows] = await Promise.all([listMyPracticeLocations(), listMyScheduleRules()]);
      const verified = locs.filter((l) => l.status === 'verified');
      setLocations(verified);
      setRules(rows);
      setLocationId((current) => (verified.some((l) => l.id === current) ? current : verified[0]?.id ?? ''));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your schedule.'); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const add = async () => {
    if (!timePattern.test(start) || !timePattern.test(end)) { setError('Use 24-hour times like 09:00 and 17:30.'); return; }
    if (end <= start) { setError('The end time must be after the start time.'); return; }
    setBusy(true); setError('');
    try { await addScheduleRule({ locationId, weekday, start, end, slotMinutes: slot }); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not add this block.'); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setError('');
    try { await deleteScheduleRule(id); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove this block.'); }
  };

  if (!session) return <Page><BackLink href="/" label="Home" /><Message kind="info">Sign in as a clinician to manage your schedule.</Message></Page>;
  const nameOf = (id: string) => locations.find((l) => l.id === id)?.venue_name ?? 'Location';

  return (
    <Page>
      <BackLink href="/" label="Home" />
      <Text style={s.title}>My schedule</Text>
      <Text style={s.body}>Set the weekly hours patients can book, per approved location. Times are Morocco time. Only approved locations can take bookings.</Text>
      {loading ? <Loading label="Loading schedule" /> : null}
      {!loading && locations.length === 0 ? <Message kind="info">You need at least one approved practice location first. Add one from “My practice locations”.</Message> : null}
      {error ? <Message kind="error">{error}</Message> : null}

      {locations.length > 0 ? (
        <>
          <Text style={s.section}>Add opening hours</Text>
          <View style={s.row}>{locations.map((l) => <Chip key={l.id} label={l.venue_name} selected={locationId === l.id} onPress={() => setLocationId(l.id)} />)}</View>
          <View style={s.row}>{days.map((d, i) => <Chip key={d} label={d} selected={weekday === i + 1} onPress={() => setWeekday(i + 1)} />)}</View>
          <Field label="From (HH:MM)" value={start} onChangeText={setStart} keyboardType="numbers-and-punctuation" maxLength={5} />
          <Field label="To (HH:MM)" value={end} onChangeText={setEnd} keyboardType="numbers-and-punctuation" maxLength={5} />
          <Text style={[s.meta, { marginTop: 14 }]}>Minutes per appointment</Text>
          <View style={s.row}>{lengths.map((m) => <Chip key={m} label={`${m}`} selected={slot === m} onPress={() => setSlot(m)} />)}</View>
          <Button label="Add hours" busy={busy} onPress={() => void add()} />
        </>
      ) : null}

      {rules.length > 0 ? <Text style={s.section}>Current weekly hours</Text> : null}
      {rules.map((r) => (
        <View key={r.id} style={s.card}>
          <Text style={s.cardTitle}>{days[r.weekday - 1]} · {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}</Text>
          <Text style={s.meta}>{nameOf(r.location_id)} · {r.slot_minutes} min slots</Text>
          <Button label="Remove" tone="danger" onPress={() => void remove(r.id)} />
        </View>
      ))}
    </Page>
  );
}
