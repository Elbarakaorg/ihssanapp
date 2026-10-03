import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { type Credentials, type PublicProfile, getMyCredentials, getMyPublicProfile, saveMyPublicProfile, submitMyCredentials } from '@/features/doctor/doctor-api';
import { BackLink, Button, Chip, Field, Message, doctorStyles as s } from '@/features/doctor/ui';
import { getClinicianVerificationStatus } from '@/features/profile/profile-repository';
import { Page } from '@/ui/patient-ui';
import { useScheme } from '@/ui/palette';

const splitList = (value: string) => [...new Set(value.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 12);

export default function DoctorProfileScreen() {
  useScheme();
  const { session } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [license, setLicense] = useState('');
  const [body, setBody] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [languages, setLanguages] = useState('');
  const [years, setYears] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [st, c, p] = await Promise.all([getClinicianVerificationStatus(), getMyCredentials(), getMyPublicProfile()]);
      setStatus(st);
      setCreds(c);
      if (c) { setLicense(c.license_number); setBody(c.issuing_body); setSpecialty(c.specialty); setCity(c.city); }
      if (p) { setHeadline(p.headline ?? ''); setBio(p.bio ?? ''); setSpecialties((p.specialties ?? []).join(', ')); setLanguages((p.languages ?? []).join(', ')); setYears(p.years_experience ? String(p.years_experience) : ''); setIsPublic(p.is_public); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your profile.'); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { if (session) void load(); }, [load, session]));

  const submitCreds = async () => {
    setBusy('creds'); setError(''); setNotice('');
    try { await submitMyCredentials({ licenseNumber: license, issuingBody: body, specialty, city }); setNotice('Submitted. We will review your license and notify you.'); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit.'); } finally { setBusy(''); }
  };
  const saveProfile = async () => {
    const yearsNumber = years.trim() ? Number(years) : null;
    if (yearsNumber !== null && (!Number.isInteger(yearsNumber) || yearsNumber < 0 || yearsNumber > 70)) { setError('Years of experience must be a whole number between 0 and 70.'); return; }
    setBusy('profile'); setError(''); setNotice('');
    const payload: PublicProfile = { headline, bio, specialties: splitList(specialties), languages: splitList(languages), years_experience: yearsNumber, is_public: isPublic };
    try { await saveMyPublicProfile(payload); setNotice(isPublic ? 'Saved. Your profile is visible to patients.' : 'Saved. Your profile is hidden from patients.'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); } finally { setBusy(''); }
  };

  if (!session) return <Page><BackLink href="/" label="Home" /><Message kind="info">Sign in as a clinician to edit your doctor profile.</Message></Page>;
  if (loading) return <Page><BackLink href="/" label="Home" /><ActivityIndicator /></Page>;

  const verified = status === 'verified';
  const locked = verified || status === 'suspended';

  return (
    <Page>
      <BackLink href="/" label="Home" />
      <Text style={s.title}>Doctor profile</Text>
      <Message kind={verified ? 'ok' : status === 'rejected' || status === 'suspended' ? 'error' : 'info'}>
        {verified ? 'Verified. You can appear in search and receive bookings.' : status === 'rejected' ? 'Your last submission was rejected. Fix the details and submit again.' : status === 'suspended' ? 'Your account is suspended. Contact support.' : creds ? 'Your credentials are waiting for review.' : 'Submit your license details so we can verify you.'}
      </Message>
      {error ? <Message kind="error">{error}</Message> : null}
      {notice ? <Message kind="ok">{notice}</Message> : null}

      {!verified ? (
        <>
          <Text style={s.section}>Credentials</Text>
          <Field label="Medical license number" value={license} onChangeText={setLicense} editable={!locked} maxLength={40} autoCapitalize="characters" />
          <Field label="Issuing body (e.g. Conseil National de l'Ordre des Médecins)" value={body} onChangeText={setBody} editable={!locked} maxLength={120} />
          <Field label="Specialty" value={specialty} onChangeText={setSpecialty} editable={!locked} maxLength={80} />
          <Field label="City" value={city} onChangeText={setCity} editable={!locked} maxLength={80} />
          {!locked ? <Button label={creds ? 'Resubmit for review' : 'Submit for verification'} busy={busy === 'creds'} onPress={() => void submitCreds()} /> : null}
        </>
      ) : null}

      <Text style={s.section}>Public profile</Text>
      <Text style={s.body}>What patients see. Your name comes from your verified account. Appears in search only when visible, verified, and with an approved location.</Text>
      <Field label="Headline" value={headline} onChangeText={setHeadline} maxLength={120} placeholder="Cardiologist · Casablanca" />
      <Field label="About you" value={bio} onChangeText={setBio} maxLength={1200} multiline />
      <Field label="Specialties (comma separated)" value={specialties} onChangeText={setSpecialties} />
      <Field label="Languages (comma separated)" value={languages} onChangeText={setLanguages} />
      <Field label="Years of experience" value={years} onChangeText={setYears} keyboardType="number-pad" maxLength={2} />
      <View style={s.row}><Chip label="Visible to patients" selected={isPublic} onPress={() => setIsPublic(true)} /><Chip label="Hidden" selected={!isPublic} onPress={() => setIsPublic(false)} /></View>
      <Button label="Save profile" busy={busy === 'profile'} onPress={() => void saveProfile()} />
      {!verified ? <Text style={s.meta}>Your profile appears to patients only after you are verified.</Text> : null}
    </Page>
  );
}
