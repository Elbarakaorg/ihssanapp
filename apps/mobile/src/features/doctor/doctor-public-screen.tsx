import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { RemoteImage } from '@/features/doctor/doctor-image';
import { type DoctorProfile, type Slot, bookAppointment, getDoctorProfile, listAvailableSlots, shareDoctorProfile } from '@/features/doctor/doctor-api';
import { BackLink, Button, Chip, Field, Message, doctorStyles as s, formatDay, formatTime, toDateKey } from '@/features/doctor/ui';
import { CommentsSection, LoveButton, SocialLinks } from '@/features/doctor/doctor-engagement';
import { Page } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';
import { Loading } from '@/ui/loading';

export default function DoctorPublicScreen() {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const [doctor, setDoctor] = useState<DoctorProfile | null | undefined>(undefined);
  const [locationId, setLocationId] = useState('');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [dayKey, setDayKey] = useState('');
  const [slot, setSlot] = useState('');
  const [mode, setMode] = useState<'in_person' | 'video'>('in_person');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    getDoctorProfile(id).then((d) => {
      if (!active) return;
      setDoctor(d);
      const first = d?.locations.find((l) => l.bookable) ?? d?.locations[0];
      if (first) { setLocationId(first.id); setMode(first.consultation_modes[0] ?? 'in_person'); }
    }).catch((e) => { if (active) { setDoctor(null); setError(e instanceof Error ? e.message : 'Could not load this doctor.'); } });
    return () => { active = false; };
  }, [id]);

  const location = doctor?.locations.find((l) => l.id === locationId);

  const loadSlots = async () => {
    if (!location?.bookable || !session) { setSlots([]); return; }
    setSlots(null); setSlot(''); setDayKey('');
    const from = toDateKey(new Date());
    const to = toDateKey(new Date(Date.now() + 14 * 86400000));
    try {
      const rows = await listAvailableSlots(id, location.id, from, to);
      setSlots(rows);
      if (rows[0]) setDayKey(toDateKey(new Date(rows[0].starts_at)));
    } catch (e) { setSlots([]); setError(e instanceof Error ? e.message : 'Could not load times.'); }
  };

  useEffect(() => { void loadSlots(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, doctor, session]);

  const dayKeys = useMemo(() => [...new Set((slots ?? []).map((x) => toDateKey(new Date(x.starts_at))))], [slots]);
  const daySlots = (slots ?? []).filter((x) => toDateKey(new Date(x.starts_at)) === dayKey);

  const book = async () => {
    if (!session) { router.push('/auth' as Href); return; }
    setBusy(true); setError('');
    try {
      await bookAppointment({ clinicianId: id, locationId, startsAt: slot, mode, reason });
      setBooked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book this time.');
      void loadSlots();
    } finally { setBusy(false); }
  };

  const isOwner = !!doctor && session?.identity.id === doctor.clinician_id;

  if (doctor === undefined) return <Page><BackLink href="/doctors" label="Find a doctor" /><Loading label="Loading profile" /></Page>;
  if (!doctor) return <Page><BackLink href="/doctors" label="Find a doctor" /><Message kind="info">{error || 'This doctor profile is not available.'}</Message></Page>;

  return (
    <Page>
      <BackLink href="/doctors" label="Find a doctor" />
      {doctor.is_preview ? <Message kind="info">Preview: your profile is hidden, so only you can see this page. Set it to Visible to publish.</Message> : null}
      <View style={styles.hero}>
        <RemoteImage bucket={doctor.featured_source === 'upload' ? 'doctor-media' : doctor.featured_source === 'account' ? 'profile-photos' : null} path={doctor.featured_source === 'upload' ? doctor.featured_image_path : doctor.avatar_path} style={styles.avatar} placeholderSize={40} />
        <View style={styles.heroCopy}>
          <Text style={s.title}>{doctor.name}</Text>
          {doctor.headline ? <Text style={s.body}>{doctor.headline}</Text> : null}
        </View>
      </View>
      <View style={[s.row, { alignItems: 'center' }]}>
        <LoveButton doctorId={doctor.clinician_id} initialCount={doctor.love_count ?? 0} initialLoved={!!doctor.loved_by_me} isOwner={isOwner} />
        <Button tone="secondary" label="Share profile" onPress={() => void shareDoctorProfile(doctor.clinician_id, doctor.name).then((r) => setNotice(r === 'copied' ? 'Link copied.' : '')).catch(() => setNotice(''))} />
      </View>
      {notice ? <Message kind="ok">{notice}</Message> : null}
      <SocialLinks links={doctor.social_links ?? []} />
      <Text style={s.meta}>{[doctor.specialties.join(', '), doctor.years_experience ? `${doctor.years_experience} years experience` : '', doctor.languages.length ? `Speaks ${doctor.languages.join(', ')}` : ''].filter(Boolean).join(' · ')}</Text>
      <Message kind="ok">Identity and license checked by Ihssan.</Message>
      {doctor.bio ? <Text style={[s.body, { marginTop: 14 }]}>{doctor.bio}</Text> : null}

      {doctor.gallery.length > 0 ? (
        <>
          <Text style={s.section}>Gallery</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
            {doctor.gallery.map((g) => <RemoteImage key={g.id} bucket="doctor-media" path={g.path} style={styles.galleryImage} />)}
          </ScrollView>
        </>
      ) : null}

      {(['work', 'education'] as const).map((kind) => {
        const items = doctor.experience.filter((e) => e.kind === kind);
        if (!items.length) return null;
        return (
          <View key={kind}>
            <Text style={s.section}>{kind === 'work' ? 'Experience' : 'Education'}</Text>
            {items.map((e, i) => (
              <View key={`${e.title}-${i}`} style={s.card}>
                <Text style={s.cardTitle}>{e.title}</Text>
                <Text style={s.meta}>{e.organization}{e.location ? ` · ${e.location}` : ''}</Text>
                <Text style={s.meta}>{e.start_year} – {e.end_year ?? 'Present'}</Text>
                {e.description ? <Text style={s.meta}>{e.description}</Text> : null}
              </View>
            ))}
          </View>
        );
      })}

      <Text style={s.section}>Where to find the doctor</Text>
      {doctor.locations.map((l) => (
        <View key={l.id} style={s.card}>
          <Text style={s.cardTitle}>{l.venue_name}</Text>
          <Text style={s.meta}>{[l.address, l.city].filter(Boolean).join(', ')}</Text>
          {l.schedule ? <Text style={s.meta}>{l.schedule}</Text> : null}
          <View style={s.row}>
            {l.latitude != null && l.longitude != null ? <Button tone="secondary" label="Directions" onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${l.latitude},${l.longitude}${l.google_place_id ? `&destination_place_id=${encodeURIComponent(l.google_place_id)}` : ''}`)} /> : null}
            {l.phone ? <Button tone="secondary" label="Call" onPress={() => void Linking.openURL(`tel:${l.phone}`)} /> : null}
          </View>
        </View>
      ))}

      <CommentsSection doctorId={doctor.clinician_id} enabled={doctor.comments_enabled !== false} isOwner={isOwner} />

      <Text style={s.section}>Book an appointment</Text>
      {booked ? (
        <>
          <Message kind="ok">Request sent. The doctor must confirm it — you can follow the status in Appointments.</Message>
          <Button label="View my appointments" onPress={() => router.push('/appointments' as Href)} />
        </>
      ) : !location?.bookable ? <Message kind="info">Online booking is not open for this doctor yet. Use the contact details above.</Message> : !session ? (
        <><Message kind="info">Sign in to see free times and book.</Message><Button label="Sign in to book" onPress={() => router.push('/auth' as Href)} /></>
      ) : (
        <>
          {doctor.locations.filter((l) => l.bookable).length > 1 ? <View style={s.row}>{doctor.locations.filter((l) => l.bookable).map((l) => <Chip key={l.id} label={l.venue_name} selected={l.id === locationId} onPress={() => { setLocationId(l.id); setMode(l.consultation_modes[0] ?? 'in_person'); }} />)}</View> : null}
          {location.consultation_modes.length > 1 ? <View style={s.row}>{location.consultation_modes.map((m) => <Chip key={m} label={m === 'video' ? 'Video' : 'In person'} selected={mode === m} onPress={() => setMode(m)} />)}</View> : null}
          {slots === null ? <Loading label="Loading times" inline state="searching" /> : null}
          {slots?.length === 0 ? <Message kind="info">No free times in the next 14 days.</Message> : null}
          <View style={s.row}>{dayKeys.map((k) => { const first = slots?.find((x) => toDateKey(new Date(x.starts_at)) === k); return <Chip key={k} label={first ? formatDay(first.starts_at) : k} selected={dayKey === k} onPress={() => { setDayKey(k); setSlot(''); }} />; })}</View>
          <View style={s.row}>{daySlots.map((x) => <Chip key={x.starts_at} label={formatTime(x.starts_at)} selected={slot === x.starts_at} onPress={() => setSlot(x.starts_at)} />)}</View>
          {slot ? <Field label="Reason for the visit (optional)" value={reason} onChangeText={setReason} maxLength={300} multiline /> : null}
          {error ? <Message kind="error">{error}</Message> : null}
          <Button label={session ? 'Request this time' : 'Sign in to book'} busy={busy} disabled={!!session && !slot} onPress={() => void book()} />
        </>
      )}
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  hero: { alignItems: 'center', flexDirection: 'row', gap: 16, marginTop: 4 },
  heroCopy: { flex: 1 },
  avatar: { borderRadius: 48, height: 96, overflow: 'hidden', width: 96 },
  gallery: { gap: 10, paddingVertical: 10 },
  galleryImage: { borderRadius: 12, height: 150, overflow: 'hidden', width: 200 },
}));
