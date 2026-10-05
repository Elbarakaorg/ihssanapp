import { type Href, useFocusEffect, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { RemoteImage } from '@/features/doctor/doctor-image';
import {
  type CvExtraction, type Credentials, type ExperienceEntry, type FeaturedSource, type GalleryImage,
  addGalleryImage, deleteGalleryImage, extractCv, getMyCredentials, getMyExperience, getMyMedia, getMyPublicProfile,
  languageOptions, pickAndUploadImage, saveMyExperience, saveMyPublicProfile, setFeaturedImage, shareDoctorProfile, submitMyCredentials,
} from '@/features/doctor/doctor-api';
import { BackLink, Button, Chip, Field, Message, doctorStyles as s } from '@/features/doctor/ui';
import { getClinicianVerificationStatus } from '@/features/profile/profile-repository';
import { Page } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';

const splitList = (value: string) => [...new Set(value.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))];
const entryKeys = new WeakMap<object, string>();
let entryKeyCounter = 0;
const entryKey = (entry: object) => {
  let key = entryKeys.get(entry);
  if (!key) { key = `entry-${++entryKeyCounter}`; entryKeys.set(entry, key); }
  return key;
};
const blankEntry = (): EntryDraft => ({ kind: 'work', title: '', organization: '', location: '', start: '', end: '', description: '' });
type EntryDraft = { kind: 'work' | 'education'; title: string; organization: string; location: string; start: string; end: string; description: string };

const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read this file.'));
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
  reader.readAsDataURL(blob);
});

export default function DoctorProfileScreen() {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.identity.id ?? '';
  const [status, setStatus] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [license, setLicense] = useState('');
  const [body, setBody] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [years, setYears] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [experience, setExperience] = useState<ExperienceEntry[]>([]);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [featured, setFeatured] = useState<FeaturedSource>('account');
  const [featuredPath, setFeaturedPath] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const dirtyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [st, c, p, exp, media] = await Promise.all([getClinicianVerificationStatus(), getMyCredentials(), getMyPublicProfile(), getMyExperience(), getMyMedia().catch(() => null)]);
      setStatus(st);
      setCreds(c);
      if (c) { setLicense(c.license_number ?? ''); setBody(c.issuing_body ?? ''); setSpecialty(c.specialty ?? ''); setCity(c.city ?? ''); }
      if (!dirtyRef.current) {
      if (p) { setHeadline(p.headline ?? ''); setBio(p.bio ?? ''); setSpecialties((p.specialties ?? []).join(', ')); setLanguages(p.languages ?? []); setYears(p.years_experience != null ? String(p.years_experience) : ''); setIsPublic(!!p.is_public); }
      setExperience(exp);
      setSavedSnapshot(JSON.stringify([p?.headline ?? '', p?.bio ?? '', (p?.specialties ?? []).join(', '), p?.languages ?? [], p?.years_experience != null ? String(p.years_experience) : '', !!p?.is_public, exp]));
      }
      if (media) { setFeatured(media.featured_source); setFeaturedPath(media.featured_image_path); setAvatarPath(media.avatar_path); setGallery(media.gallery); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your profile.'); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { if (session) void load(); }, [load, session]));

  const run = async (key: string, task: () => Promise<void>) => {
    if (busy) return;
    setBusy(key); setError(''); setNotice('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(''); }
  };

  const snapshot = JSON.stringify([headline, bio, specialties, languages, years, isPublic, experience]);
  const dirty = savedSnapshot !== '' && snapshot !== savedSnapshot;
  dirtyRef.current = dirty;

  const submitCreds = () => run('creds', async () => {
    await submitMyCredentials({ licenseNumber: license, issuingBody: body, specialty, city });
    setNotice('Submitted. We will review your license and notify you.');
    await load();
  });

  const saveAll = () => run('save', async () => {
    const yearsNumber = years.trim() ? Number(years) : null;
    if (yearsNumber !== null && (!Number.isInteger(yearsNumber) || yearsNumber < 0 || yearsNumber > 70)) throw new Error('Years of experience must be a whole number between 0 and 70.');
    const list = splitList(specialties);
    if (list.length > 5) throw new Error('You can list up to 5 specialties.');
    if (list.some((item) => item.length < 2 || item.length > 60)) throw new Error('Each specialty must be 2–60 characters.');
    await saveMyPublicProfile({ headline, bio, specialties: list, languages, years_experience: yearsNumber, is_public: isPublic });
    await saveMyExperience(experience);
    setSavedSnapshot(snapshot);
    setNotice(isPublic ? 'Saved. Your profile is visible to patients.' : 'Saved. Your profile is hidden from patients.');
  });

  const chooseFeatured = (source: FeaturedSource) => run('featured', async () => {
    if (source === 'upload') {
      const path = await pickAndUploadImage([1, 1]);
      if (!path) return;
      await setFeaturedImage('upload', path);
      setFeaturedPath(path);
    } else {
      await setFeaturedImage(source);
    }
    setFeatured(source);
  });

  const addPhoto = () => run('gallery', async () => {
    if (gallery.length >= 12) throw new Error('You can add up to 12 photos.');
    const path = await pickAndUploadImage([4, 3]);
    if (!path) return;
    await addGalleryImage(path);
    setGallery((await getMyMedia()).gallery);
  });

  const removePhoto = (id: string) => run('gallery', async () => {
    await deleteGalleryImage(id);
    setGallery((items) => items.filter((item) => item.id !== id));
  });

  const importCv = () => run('cv', async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    if (asset.size && asset.size > 5 * 1024 * 1024) throw new Error('Choose a PDF smaller than 5 MB.');
    const base64 = await toBase64(await (await fetch(asset.uri)).blob());
    const result: CvExtraction = await extractCv(base64);
    if (result.headline) setHeadline(result.headline);
    if (result.bio) setBio(result.bio);
    if (result.specialties.length) setSpecialties(result.specialties.join(', '));
    if (result.languages.length) setLanguages(result.languages);
    if (result.years_experience !== null) setYears(String(result.years_experience));
    if (result.experience.length) setExperience(result.experience);
    setNotice('We filled in your profile from the CV. Check every field, then press Save profile — nothing is published until you save.');
  });

  const addEntry = () => {
    if (!draft) return;
    const start = Number(draft.start);
    const end = draft.end.trim() ? Number(draft.end) : null;
    const thisYear = new Date().getFullYear();
    if (draft.title.trim().length < 2 || draft.organization.trim().length < 2) { setError('Add a title and an organization.'); return; }
    if (!Number.isInteger(start) || start < 1950 || start > thisYear + 1) { setError('Enter a valid start year, like 2015.'); return; }
    if (end !== null && (!Number.isInteger(end) || end < start || end > thisYear + 8)) { setError('The end year must be a year after the start year, or empty if you still work there.'); return; }
    setError('');
    setExperience((items) => [...items, { kind: draft.kind, title: draft.title.trim(), organization: draft.organization.trim(), location: draft.location.trim() || null, start_year: start, end_year: end, description: draft.description.trim() || null }]);
    setDraft(null);
  };

  const share = () => run('share', async () => {
    const result = await shareDoctorProfile(userId, 'My doctor profile');
    if (result === 'copied') setNotice('Link copied. Paste it anywhere to share your profile.');
  });

  if (!session) return <Page><BackLink href="/" label="Home" /><Message kind="info">Sign in as a clinician to edit your doctor profile.</Message></Page>;
  if (loading) return <Page><BackLink href="/" label="Home" /><ActivityIndicator /></Page>;

  const verified = status === 'verified';
  const locked = verified || status === 'suspended';
  const preferredPhoto = featured === 'upload' ? { bucket: 'doctor-media', path: featuredPath } : featured === 'account' ? { bucket: 'profile-photos', path: avatarPath } : { bucket: null, path: null };

  return (
    <Page>
      <BackLink href="/" label="Home" />
      <Text style={s.title}>Doctor profile</Text>
      <Message kind={verified ? 'ok' : status === 'rejected' || status === 'suspended' ? 'error' : 'info'}>
        {verified ? 'Verified. You can appear in search and receive bookings.' : status === 'rejected' ? 'Your last submission was rejected. Fix the details and submit again.' : status === 'suspended' ? 'Your account is suspended. Contact support.' : creds ? 'Your credentials are waiting for review.' : 'Submit your license details so we can verify you.'}
      </Message>
      {error ? <Message kind="error">{error}</Message> : null}
      {notice ? <Message kind="ok">{notice}</Message> : null}
      {verified ? (
        <View style={s.row}>
          <Button label="Preview my profile" tone="secondary" onPress={() => router.push(`/doctors/${userId}` as Href)} />
          <Button label="Share my profile" tone="secondary" busy={busy === 'share'} onPress={() => void share()} />
        </View>
      ) : null}

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

      <Text style={s.section}>Import from your CV</Text>
      <Text style={s.meta}>Upload a PDF and we will fill in your headline, summary, specialties, languages and experience for you to review. The file is sent to our AI provider (OpenAI) for reading only and is not stored by Ihssan.</Text>
      <Button label="Upload CV (PDF)" tone="secondary" busy={busy === 'cv'} onPress={() => void importCv()} />

      <Text style={s.section}>Featured photo</Text>
      <View style={styles.photoRow}>
        <RemoteImage bucket={preferredPhoto.bucket} path={preferredPhoto.path} style={styles.avatar} placeholderSize={34} />
        <View style={styles.photoChoices}>
          <Chip label="Use my account photo" selected={featured === 'account'} onPress={() => void chooseFeatured('account')} />
          <Chip label={featured === 'upload' ? 'Replace uploaded photo' : 'Upload a different photo'} selected={featured === 'upload'} onPress={() => void chooseFeatured('upload')} />
          <Chip label="No photo" selected={featured === 'none'} onPress={() => void chooseFeatured('none')} />
        </View>
      </View>
      {!verified ? <Text style={s.meta}>Photos can be changed once you are verified.</Text> : null}

      <Text style={s.section}>Gallery ({gallery.length}/12)</Text>
      <Text style={s.meta}>Show your clinic, team and equipment. Don’t upload patient photos.</Text>
      <View style={styles.grid}>
        {gallery.map((g) => (
          <View key={g.id} style={styles.tile}>
            <RemoteImage bucket="doctor-media" path={g.path} style={styles.tileImage} />
            <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => void removePhoto(g.id)} style={styles.remove}><Text style={styles.removeLabel}>×</Text></Pressable>
          </View>
        ))}
      </View>
      <Button label="Add a photo" tone="secondary" busy={busy === 'gallery'} disabled={gallery.length >= 12} onPress={() => void addPhoto()} />

      <Text style={s.section}>About</Text>
      <Field label="Headline" value={headline} onChangeText={setHeadline} maxLength={120} placeholder="Cardiologist · Casablanca" />
      <Field label="About you" value={bio} onChangeText={setBio} maxLength={1500} multiline />
      <Field label="Specialties (comma separated, up to 5)" value={specialties} onChangeText={setSpecialties} />
      <Text style={[s.meta, splitList(specialties).length > 5 && { color: '#9A3E2A' }]}>{splitList(specialties).length}/5 · each 2–60 characters</Text>
      <Text style={[s.meta, { marginTop: 14 }]}>Languages you speak</Text>
      <View style={s.row}>{languageOptions.map(([code, label]) => <Chip key={code} label={label} selected={languages.includes(code)} onPress={() => setLanguages((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]))} />)}</View>
      <Field label="Years of experience" value={years} onChangeText={setYears} keyboardType="number-pad" maxLength={2} />

      <Text style={s.section}>Experience & education</Text>
      {experience.map((e, index) => (
        <View key={entryKey(e)} style={s.card}>
          <Text style={s.cardTitle}>{e.title}</Text>
          <Text style={s.meta}>{e.organization}{e.location ? ` · ${e.location}` : ''} · {e.kind === 'work' ? 'Work' : 'Education'}</Text>
          <Text style={s.meta}>{e.start_year} – {e.end_year ?? 'Present'}</Text>
          {e.description ? <Text numberOfLines={3} style={s.meta}>{e.description}</Text> : null}
          <Button label="Remove" tone="danger" onPress={() => setExperience((items) => items.filter((_, i) => i !== index))} />
        </View>
      ))}
      {draft ? (
        <View style={s.card}>
          <View style={s.row}><Chip label="Work" selected={draft.kind === 'work'} onPress={() => setDraft({ ...draft, kind: 'work' })} /><Chip label="Education" selected={draft.kind === 'education'} onPress={() => setDraft({ ...draft, kind: 'education' })} /></View>
          <Field label={draft.kind === 'work' ? 'Position' : 'Degree'} value={draft.title} onChangeText={(v) => setDraft({ ...draft, title: v })} maxLength={120} />
          <Field label={draft.kind === 'work' ? 'Hospital / clinic' : 'School'} value={draft.organization} onChangeText={(v) => setDraft({ ...draft, organization: v })} maxLength={120} />
          <Field label="Location (optional)" value={draft.location} onChangeText={(v) => setDraft({ ...draft, location: v })} maxLength={80} />
          <Field label="Start year" value={draft.start} onChangeText={(v) => setDraft({ ...draft, start: v })} keyboardType="number-pad" maxLength={4} />
          <Field label="End year (empty = present)" value={draft.end} onChangeText={(v) => setDraft({ ...draft, end: v })} keyboardType="number-pad" maxLength={4} />
          <Field label="Description (optional)" value={draft.description} onChangeText={(v) => setDraft({ ...draft, description: v })} multiline maxLength={600} />
          {error ? <Message kind="error">{error}</Message> : null}
          <Button label="Add to profile" onPress={addEntry} />
          <Button label="Cancel" tone="secondary" onPress={() => setDraft(null)} />
        </View>
      ) : <Button label="Add experience or education" tone="secondary" onPress={() => setDraft(blankEntry())} />}

      <Text style={s.section}>Contact</Text>
      <Text style={s.meta}>Patients contact you through your approved practice locations (clinics and hospitals), shown with directions and phone.</Text>
      <Button label="Manage practice locations" tone="secondary" onPress={() => router.push('/practice-locations' as Href)} />

      <Text style={s.section}>Visibility</Text>
      <Text style={s.meta}>Appears in Find a doctor only when visible, verified, and with an approved location.</Text>
      <View style={s.row}><Chip label="Visible to patients" selected={isPublic} onPress={() => setIsPublic(true)} /><Chip label="Hidden" selected={!isPublic} onPress={() => setIsPublic(false)} /></View>
      {error ? <Message kind="error">{error}</Message> : null}
      {notice ? <Message kind="ok">{notice}</Message> : null}
      {dirty ? <Message kind="info">You have unsaved changes.</Message> : null}
      <Button label="Save profile" busy={busy === 'save'} onPress={() => void saveAll()} />
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  photoRow: { alignItems: 'center', flexDirection: 'row', gap: 16, marginTop: 10 },
  photoChoices: { flex: 1, gap: 8 },
  avatar: { borderRadius: 48, height: 96, overflow: 'hidden', width: 96 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tile: { height: 96, width: 128 },
  tileImage: { borderRadius: 10, height: 96, overflow: 'hidden', width: 128 },
  remove: { alignItems: 'center', backgroundColor: palette.ink, borderRadius: 12, height: 24, justifyContent: 'center', position: 'absolute', right: 4, top: 4, width: 24 },
  removeLabel: { color: palette.white, fontSize: 16, fontWeight: '700', lineHeight: 18 },
}));
