import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { type Appointment, listMyAppointments, updateAppointmentStatus } from '@/features/doctor/doctor-api';
import { BackLink, Button, Chip, Message, doctorStyles as s, formatDay, formatTime } from '@/features/doctor/ui';
import { Page } from '@/ui/patient-ui';
import { useScheme } from '@/ui/palette';

const statusLabel: Record<string, string> = {
  requested: 'Waiting for confirmation', confirmed: 'Confirmed', declined: 'Declined', cancelled: 'Cancelled',
  completed: 'Completed', no_show: 'No-show', expired: 'Expired — not confirmed in time',
};

export default function AppointmentsScreen() {
  useScheme();
  const { session } = useAuth();
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setError('');
    try { setItems(await listMyAppointments(scope)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load appointments.'); setItems([]); }
  }, [scope, session]);

  useFocusEffect(useCallback(() => { setItems(null); void load(); }, [load]));

  const act = async (id: string, status: string) => {
    if (busyId) return;
    setBusyId(id);
    setError('');
    try { await updateAppointmentStatus(id, status); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update.'); await load(); } finally { setBusyId(''); }
  };

  if (!session) return <Page><BackLink href="/" label="Home" /><Text style={s.title}>Appointments</Text><Message kind="info">Sign in to see your appointments.</Message></Page>;

  return (
    <Page>
      <BackLink href="/" label="Home" />
      <Text style={s.title}>Appointments</Text>
      <Text style={s.body}>Times are shown in Morocco time.</Text>
      <View style={s.row}><Chip label="Upcoming" selected={scope === 'upcoming'} onPress={() => setScope('upcoming')} /><Chip label="Past" selected={scope === 'past'} onPress={() => setScope('past')} /></View>
      {error ? <Message kind="error">{error}</Message> : null}
      {items === null ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
      {items?.length === 0 && !error ? <Message kind="info">{scope === 'upcoming' ? 'No upcoming appointments.' : 'No past appointments yet.'}</Message> : null}
      {items?.map((a) => {
        const isDoctor = a.viewer_role === 'clinician';
        const busy = busyId === a.id;
        const started = new Date(a.starts_at).getTime() <= Date.now();
        return (
          <View key={a.id} style={s.card}>
            <Text style={s.cardTitle}>{formatDay(a.starts_at)} · {formatTime(a.starts_at)}–{formatTime(a.ends_at)}</Text>
            <Text style={s.meta}>{isDoctor ? `Patient: ${a.counterpart_name}` : a.counterpart_name}</Text>
            <Text style={s.meta}>{a.venue_name}{a.venue_address ? ` · ${a.venue_address}` : ''} · {a.mode === 'video' ? 'Video' : 'In person'}</Text>
            {a.reason ? <Text style={s.meta}>Reason: {a.reason}</Text> : null}
            <Text style={s.cardTitle}>{statusLabel[a.status] ?? a.status}</Text>
            {a.decision_note ? <Text style={s.meta}>Note: {a.decision_note}</Text> : null}
            {isDoctor && a.status === 'requested' ? <><Button label="Confirm" busy={busy} onPress={() => void act(a.id, 'confirmed')} /><Button label="Decline" tone="secondary" disabled={busy} onPress={() => void act(a.id, 'declined')} /></> : null}
            {isDoctor && a.status === 'confirmed' && started ? <><Button label="Mark completed" busy={busy} onPress={() => void act(a.id, 'completed')} /><Button label="Patient did not attend" tone="secondary" disabled={busy} onPress={() => void act(a.id, 'no_show')} /></> : null}
            {(a.status === 'requested' || a.status === 'confirmed') && !started ? <Button label="Cancel appointment" tone="danger" disabled={busy} onPress={() => void act(a.id, 'cancelled')} /> : null}
          </View>
        );
      })}
    </Page>
  );
}
