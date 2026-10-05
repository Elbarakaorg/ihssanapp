import { useFocusEffect, useRouter } from 'expo-router';
import { Activity, ArrowRight, CalendarDays, Check, ChevronRight, CircleHelp, Heart, LockKeyhole, Pencil, Plus, QrCode, ShieldCheck, Star, UserRound, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { getAvatarUrl, getCurrentUserProfile, type AccountProfile } from '@/features/profile/profile-repository';
import { emptyMedicalProfile, getMedicalProfile, listDoctorShares, listFavoriteDoctors, listPendingShareRequests, respondToShareRequest, revokeDoctorShare, saveMedicalProfile, setDoctorFavorite, type DoctorShare, type FavoriteDoctor, type MedicalProfile, type ShareRequest } from '@/features/profile/medical-profile-repository';
import { Page, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { Loading } from '@/ui/loading';

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function MedicalProfileScreen() {
  useScheme();
  const router = useRouter();
  const { isReady, session } = useAuth();
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [medical, setMedical] = useState<MedicalProfile>(emptyMedicalProfile);
  const [savedMedical, setSavedMedical] = useState<MedicalProfile>(emptyMedicalProfile);
  const [shares, setShares] = useState<DoctorShare[]>([]);
  const [favorites, setFavorites] = useState<FavoriteDoctor[]>([]);
  const [requests, setRequests] = useState<ShareRequest[]>([]);
  const [measurementChoices, setMeasurementChoices] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    if (!session) {
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    void Promise.all([
      getCurrentUserProfile(),
      getMedicalProfile(),
      listDoctorShares(),
      listFavoriteDoctors(),
      listPendingShareRequests(),
    ]).then(async ([nextAccount, nextMedical, nextShares, nextFavorites, nextRequests]) => {
      if (!active) return;
      setAccount(nextAccount);
      setMedical(nextMedical);
      setSavedMedical(nextMedical);
      setShares(nextShares);
      setFavorites(nextFavorites);
      setRequests(nextRequests);
      setAvatarUrl(await getAvatarUrl(nextAccount.avatar_path));
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your medical profile.');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [session]);

  const refreshSharing = async () => {
    const [nextShares, nextFavorites, nextRequests] = await Promise.all([
      listDoctorShares(),
      listFavoriteDoctors(),
      listPendingShareRequests(),
    ]);
    setShares(nextShares);
    setFavorites(nextFavorites);
    setRequests(nextRequests);
  };

  useFocusEffect(useCallback(() => {
    if (!session) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const [nextShares, nextFavorites, nextRequests] = await Promise.all([
          listDoctorShares(),
          listFavoriteDoctors(),
          listPendingShareRequests(),
        ]);
        if (active) {
          setShares(nextShares);
          setFavorites(nextFavorites);
          setRequests(nextRequests);
        }
      } catch {
        if (active) setError('Could not refresh your doctor sharing information.');
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session]));

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveMedicalProfile(medical);
      setSavedMedical(medical);
      setEditing(false);
      setNotice('Medical profile saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your medical profile.');
    } finally {
      setSaving(false);
    }
  };

  const respond = (request: ShareRequest, approve: boolean) => {
    if (!approve) {
      Alert.alert('Decline access request?', `${request.clinician_name} will not be able to view your medical profile.`, [
        { text: 'Keep request', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => void processResponse(request, false) },
      ]);
      return;
    }
    Alert.alert('Share your medical profile?', `This gives ${request.clinician_name} access to the information you select. You can revoke access here at any time.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Share profile', onPress: () => void processResponse(request, true) },
    ]);
  };

  const processResponse = async (request: ShareRequest, approve: boolean) => {
    setBusyId(request.id);
    setError('');
    try {
      await respondToShareRequest(request.id, approve, measurementChoices[request.id] ?? false);
      await refreshSharing();
      setNotice(approve ? `Access granted to ${request.clinician_name}.` : 'Access request declined.');
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : 'Could not update the access request.');
    } finally {
      setBusyId('');
    }
  };

  const revoke = (share: DoctorShare) => {
    const name = share.clinician?.public_name ?? 'this clinician';
    Alert.alert('Revoke profile access?', `${name} will no longer be able to view information shared through Ihssan.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke access', style: 'destructive', onPress: () => void processRevoke(share) },
    ]);
  };

  const processRevoke = async (share: DoctorShare) => {
    setBusyId(share.id);
    setError('');
    try {
      await revokeDoctorShare(share.id);
      await refreshSharing();
      setNotice('Doctor access revoked.');
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Could not revoke access.');
    } finally {
      setBusyId('');
    }
  };

  const toggleFavorite = async (clinicianId: string, isFavorite: boolean) => {
    setBusyId(clinicianId);
    setError('');
    try {
      await setDoctorFavorite(clinicianId, !isFavorite);
      setFavorites(await listFavoriteDoctors());
    } catch (favoriteError) {
      setError(favoriteError instanceof Error ? favoriteError.message : 'Could not update saved doctors.');
    } finally {
      setBusyId('');
    }
  };

  if (loading || (!isReady && !session)) {
    return <Page><Loading label="Loading your medical profile" /></Page>;
  }

  if (!session) {
    return <Page>
      <PreviewNotice />
      <View style={styles.signInState}>
        <View style={styles.heroIcon}><Activity color={palette.forest} size={24} /></View>
        <Text style={styles.title}>Your medical profile</Text>
        <Text style={styles.body}>Keep your important medical information together and choose which verified doctors can view it.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Sign in to continue</Text></Pressable>
      </View>
    </Page>;
  }

  const activeShares = shares.filter((share) => !share.revoked_at);
  const revokedShares = shares.filter((share) => share.revoked_at);
  const favoriteIds = new Set(favorites.map((favorite) => favorite.clinician_id));

  return (
    <Page>
      <PreviewNotice />
      <View style={styles.hero}>
        <View style={styles.avatar}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <UserRound color={palette.forest} size={27} />}
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>Medical profile</Text>
          <Text style={styles.title}>{account?.display_name || 'Your profile'}</Text>
          <Text style={styles.body}>{account?.bio || 'A concise health summary you control and can share with your care team.'}</Text>
        </View>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

      <View style={styles.shareBanner}>
        <View style={styles.shareBannerIcon}><QrCode color={palette.white} size={20} /></View>
        <View style={styles.shareBannerCopy}>
          <Text style={styles.shareBannerTitle}>Share your profile securely</Text>
          <Text style={styles.shareBannerBody}>A doctor must be verified, and you approve every request before anything is shared.</Text>
        </View>
        <Pressable accessibilityLabel="Create a patient-approved profile QR code" accessibilityRole="button" onPress={() => router.push('/share/profile')} style={styles.shareArrow}><ArrowRight color={palette.forest} size={20} /></Pressable>
      </View>

      {requests.length ? <>
        <SectionHeading title="Access requests" detail="Your approval is required" />
        <View style={styles.stack}>
          {requests.map((request) => <View key={request.id} style={[uiStyles.card, styles.requestCard]}>
            <View style={styles.rowIcon}><UserRound color={palette.forest} size={18} /></View>
            <View style={styles.requestCopy}>
              <Text style={styles.rowTitle}>{request.clinician_name}</Text>
              <Text style={styles.rowDetail}>Verified clinician · requested {formatDate(request.created_at)}</Text>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: measurementChoices[request.id] ?? false }} onPress={() => setMeasurementChoices((current) => ({ ...current, [request.id]: !(current[request.id] ?? false) }))} style={styles.checkboxRow}>
                <View style={[styles.checkbox, measurementChoices[request.id] && styles.checkboxChecked]}>{measurementChoices[request.id] ? <Check color={palette.white} size={12} /> : null}</View>
                <Text style={styles.checkboxLabel}>Also share my measurement history</Text>
              </Pressable>
              <View style={styles.requestActions}>
                <Pressable accessibilityRole="button" disabled={busyId === request.id} onPress={() => respond(request, true)} style={styles.approveButton}><Text style={styles.approveLabel}>{busyId === request.id ? 'Updating…' : 'Approve sharing'}</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={busyId === request.id} onPress={() => respond(request, false)} style={styles.declineButton}><Text style={styles.declineLabel}>Decline</Text></Pressable>
              </View>
            </View>
          </View>)}
        </View>
      </> : null}

      <SectionHeading title="Medical essentials" detail={editing ? 'Only share with clinicians you approve' : undefined} />
      <View style={[uiStyles.card, styles.sectionCard]}>
        <View style={styles.sectionTop}>
          <View style={styles.sectionTitleGroup}><View style={styles.smallIcon}><Activity color={palette.forest} size={17} /></View><Text style={styles.cardTitle}>Health information</Text></View>
          <Pressable accessibilityRole="button" onPress={() => { setError(''); setNotice(''); setMedical(savedMedical); setEditing((value) => !value); }} style={styles.editButton}>
            {editing ? <X color={palette.forest} size={16} /> : <Pencil color={palette.forest} size={15} />}
            <Text style={styles.editButtonText}>{editing ? 'Cancel' : 'Edit'}</Text>
          </Pressable>
        </View>
        {editing ? (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Date of birth</Text>
            <TextInput accessibilityLabel="Date of birth" onChangeText={(value) => setMedical((current) => ({ ...current, date_of_birth: value }))} placeholder="YYYY-MM-DD" placeholderTextColor="#8A958E" style={styles.input} value={medical.date_of_birth} />
            <Text style={styles.fieldLabel}>Blood type</Text>
            <View style={styles.bloodTypes}>{bloodTypes.map((type) => <Pressable accessibilityRole="button" accessibilityState={{ selected: medical.blood_type === type }} key={type} onPress={() => setMedical((current) => ({ ...current, blood_type: current.blood_type === type ? '' : type }))} style={[styles.bloodType, medical.blood_type === type && styles.bloodTypeSelected]}><Text style={[styles.bloodTypeText, medical.blood_type === type && styles.bloodTypeTextSelected]}>{type}</Text></Pressable>)}</View>
            <Text style={styles.fieldLabel}>Allergies <Text style={styles.fieldHint}>one per line</Text></Text>
            <TextInput accessibilityLabel="Allergies" multiline onChangeText={(value) => setMedical((current) => ({ ...current, allergies: parseList(value) }))} placeholder="No known allergies" placeholderTextColor="#8A958E" style={[styles.input, styles.multiline]} textAlignVertical="top" value={medical.allergies.join('\n')} />
            <Text style={styles.fieldLabel}>Ongoing conditions <Text style={styles.fieldHint}>one per line</Text></Text>
            <TextInput accessibilityLabel="Ongoing conditions" multiline onChangeText={(value) => setMedical((current) => ({ ...current, conditions: parseList(value) }))} placeholder="Add a condition" placeholderTextColor="#8A958E" style={[styles.input, styles.multiline]} textAlignVertical="top" value={medical.conditions.join('\n')} />
            <Text style={styles.fieldLabel}>Current medications <Text style={styles.fieldHint}>include dose if useful</Text></Text>
            <TextInput accessibilityLabel="Current medications" multiline onChangeText={(value) => setMedical((current) => ({ ...current, medications: parseList(value) }))} placeholder="Medicine and dose" placeholderTextColor="#8A958E" style={[styles.input, styles.multiline]} textAlignVertical="top" value={medical.medications.join('\n')} />
            <Text style={styles.fieldLabel}>Surgeries and procedures</Text>
            <TextInput accessibilityLabel="Surgeries and procedures" multiline onChangeText={(value) => setMedical((current) => ({ ...current, surgeries: parseList(value) }))} placeholder="Optional" placeholderTextColor="#8A958E" style={[styles.input, styles.multiline]} textAlignVertical="top" value={medical.surgeries.join('\n')} />
          </View>
        ) : (
          <View style={styles.facts}>
            <Fact label="Date of birth" value={medical.date_of_birth ? formatDateOnly(medical.date_of_birth) : 'Not added'} />
            <Fact label="Blood type" value={medical.blood_type || 'Not added'} />
            <ListFact label="Allergies" values={medical.allergies} empty="None recorded" caution />
            <ListFact label="Ongoing conditions" values={medical.conditions} empty="None recorded" />
            <ListFact label="Current medications" values={medical.medications} empty="None recorded" />
            <ListFact label="Surgeries and procedures" values={medical.surgeries} empty="None recorded" />
          </View>
        )}
      </View>

      <SectionHeading title="Emergency contact" />
      <View style={[uiStyles.card, styles.sectionCard]}>
        {editing ? <View style={styles.form}>
          <Text style={styles.fieldLabel}>Contact name</Text>
          <TextInput accessibilityLabel="Emergency contact name" onChangeText={(value) => setMedical((current) => ({ ...current, emergency_contact_name: value }))} placeholder="Full name" placeholderTextColor="#8A958E" style={styles.input} value={medical.emergency_contact_name} />
          <Text style={styles.fieldLabel}>Relationship</Text>
          <TextInput accessibilityLabel="Emergency contact relationship" onChangeText={(value) => setMedical((current) => ({ ...current, emergency_contact_relation: value }))} placeholder="For example, spouse or sibling" placeholderTextColor="#8A958E" style={styles.input} value={medical.emergency_contact_relation} />
          <Text style={styles.fieldLabel}>Phone number</Text>
          <TextInput accessibilityLabel="Emergency contact phone number" keyboardType="phone-pad" onChangeText={(value) => setMedical((current) => ({ ...current, emergency_contact_phone: value }))} placeholder="+212 …" placeholderTextColor="#8A958E" style={styles.input} value={medical.emergency_contact_phone} />
        </View> : medical.emergency_contact_name || medical.emergency_contact_phone ? <View style={styles.contactRow}><View style={styles.rowIcon}><UserRound color={palette.forest} size={18} /></View><View style={styles.requestCopy}><Text style={styles.rowTitle}>{medical.emergency_contact_name || 'Contact'}</Text><Text style={styles.rowDetail}>{[medical.emergency_contact_relation, medical.emergency_contact_phone].filter(Boolean).join(' · ')}</Text></View></View> : <Text style={styles.emptyCopy}>Add someone your care team can contact in an emergency.</Text>}
      </View>
      {editing ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.primaryButton, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color={palette.white} /> : <><Check color={palette.white} size={17} /><Text style={styles.primaryButtonText}>Save medical profile</Text></>}
      </Pressable> : null}

      <SectionHeading title="Doctors with profile access" detail={`${activeShares.length} active`} />
      {activeShares.length ? <View style={styles.stack}>{activeShares.map((share) => {
        const name = share.clinician?.public_name ?? 'Verified clinician';
        const isFavorite = favoriteIds.has(share.clinician_id);
        return <View key={share.id} style={[uiStyles.card, styles.doctorRow]}>
          <View style={styles.rowIcon}><UserRound color={palette.forest} size={18} /></View>
          <View style={styles.requestCopy}><Text style={styles.rowTitle}>{name}</Text><Text style={styles.rowDetail}>Shared {formatDate(share.granted_at)} · {share.scope.medical_profile ? 'Medical profile' : ''}{share.scope.measurements ? ' + measurements' : ''}</Text></View>
          <Pressable accessibilityLabel={isFavorite ? `Remove ${name} from saved doctors` : `Save ${name}`} accessibilityRole="button" disabled={busyId === share.clinician_id} onPress={() => void toggleFavorite(share.clinician_id, isFavorite)} style={styles.starButton}><Star color={isFavorite ? palette.gold : palette.muted} fill={isFavorite ? palette.gold : 'transparent'} size={19} /></Pressable>
          <Pressable accessibilityLabel={`Revoke ${name}'s access`} accessibilityRole="button" disabled={busyId === share.id} onPress={() => revoke(share)} style={styles.revokeButton}><LockKeyhole color={palette.coral} size={17} /></Pressable>
        </View>;
      })}</View> : <EmptyLine icon={ShieldCheck} text="No doctors have access to your profile." />}

      {revokedShares.length ? <View style={styles.historyBlock}>
        <Text style={styles.historyTitle}>Previously shared</Text>
        {revokedShares.map((share) => <View key={share.id} style={styles.historyRow}><Text style={styles.historyName}>{share.clinician?.public_name ?? 'Clinician'}</Text><Text style={styles.historyDate}>Revoked {formatDate(share.revoked_at ?? '')}</Text></View>)}
      </View> : null}

      <SectionHeading title="Saved doctors" detail={`${favorites.length} saved`} />
      {favorites.length ? <View style={styles.stack}>{favorites.map((favorite) => <View key={favorite.clinician_id} style={[uiStyles.card, styles.doctorRow]}>
        <View style={styles.rowIcon}><Heart color={palette.coral} size={17} fill={palette.coral} /></View>
        <View style={styles.requestCopy}><Text style={styles.rowTitle}>{favorite.clinician?.public_name ?? 'Verified clinician'}</Text><Text style={styles.rowDetail}>Saved {formatDate(favorite.created_at)}</Text></View>
        <Pressable accessibilityLabel="Remove saved doctor" accessibilityRole="button" disabled={busyId === favorite.clinician_id} onPress={() => void toggleFavorite(favorite.clinician_id, true)} style={styles.removeButton}><X color={palette.muted} size={17} /></Pressable>
      </View>)}</View> : <EmptyLine icon={Heart} text="Doctors you save will be collected here. Save one from your shared-doctor list or care directory." />}

      <SectionHeading title="Appointments" detail="Your visits" />
      <View style={[uiStyles.card, styles.appointmentEmpty]}>
        <View style={styles.appointmentIcon}><CalendarDays color={palette.forest} size={20} /></View>
        <View style={styles.appointmentCopy}><Text style={styles.rowTitle}>No appointments yet</Text><Text style={styles.rowDetail}>Appointments booked through Ihssan will appear here. Booking is not available in this release.</Text></View>
        <ChevronRight color={palette.muted} size={17} />
      </View>

      <View style={styles.privacyNote}><ShieldCheck color={palette.forest} size={17} /><Text style={styles.privacyText}>Your medical profile is private by default. Sharing access is explicit, limited to the categories you approve, and revocable here.</Text></View>
    </Page>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  useScheme();
  return <View style={styles.factRow}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

function ListFact({ label, values, empty, caution = false }: { label: string; values: string[]; empty: string; caution?: boolean }) {
  useScheme();
  return <View style={styles.listFact}>
    <Text style={styles.factLabel}>{label}</Text>
    {values.length ? <View style={styles.tags}>{values.map((value, index) => <Text key={`${value}-${index}`} style={[styles.tag, caution && styles.cautionTag]}>{value}</Text>)}</View> : <Text style={styles.emptyFact}>{empty}</Text>}
  </View>;
}

function EmptyLine({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  useScheme();
  return <View style={styles.emptyLine}><Icon color={palette.muted} size={18} /><Text style={styles.emptyCopy}>{text}</Text></View>;
}

function parseList(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateOnly(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

const styles = themedStyles(() => StyleSheet.create({
  loading: { alignItems: 'center', gap: 10, marginTop: 70 },
  muted: { color: palette.muted, fontSize: 13 },
  signInState: { alignItems: 'center', marginTop: 46, paddingHorizontal: 12 },
  heroIcon: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  title: { ...display, color: palette.ink, fontSize: 23 },
  body: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 7, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 11, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 18, minHeight: 46, paddingHorizontal: 16 },
  primaryButtonText: { color: palette.white, fontSize: 13, fontWeight: '700' },
  hero: { alignItems: 'center', flexDirection: 'row', gap: 15, marginBottom: 22 },
  avatar: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 32, height: 64, justifyContent: 'center', overflow: 'hidden', width: 64 },
  avatarImage: { height: 64, width: 64 },
  heroCopy: { flex: 1 },
  eyebrow: { color: palette.forest, fontSize: 12, fontWeight: '600', marginBottom: 5 },
  error: { backgroundColor: '#FCE9E5', borderRadius: 10, color: '#9A3E2A', fontSize: 12, lineHeight: 18, marginBottom: 12, padding: 12 },
  notice: { backgroundColor: palette.leaf, borderRadius: 10, color: palette.forest, fontSize: 12, lineHeight: 18, marginBottom: 12, padding: 12 },
  shareBanner: { alignItems: 'center', backgroundColor: palette.ink, borderRadius: 15, flexDirection: 'row', gap: 12, padding: 15 },
  shareBannerIcon: { alignItems: 'center', backgroundColor: '#31594A', borderRadius: 21, height: 42, justifyContent: 'center', width: 42 },
  shareBannerCopy: { flex: 1 },
  shareBannerTitle: { color: palette.white, fontSize: 14, fontWeight: '700' },
  shareBannerBody: { color: '#D0DAD4', fontSize: 11, lineHeight: 16, marginTop: 4 },
  shareArrow: { alignItems: 'center', backgroundColor: palette.white, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  stack: { gap: 9 },
  requestCard: { alignItems: 'flex-start', flexDirection: 'row', gap: 11, padding: 14 },
  rowIcon: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  requestCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  rowDetail: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  checkboxRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 11, minHeight: 30 },
  checkbox: { alignItems: 'center', borderColor: palette.line, borderRadius: 5, borderWidth: 1, height: 19, justifyContent: 'center', width: 19 },
  checkboxChecked: { backgroundColor: palette.forest, borderColor: palette.forest },
  checkboxLabel: { color: palette.ink, flex: 1, fontSize: 11 },
  requestActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  approveButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 9, justifyContent: 'center', minHeight: 38, paddingHorizontal: 12 },
  approveLabel: { color: palette.white, fontSize: 11, fontWeight: '700' },
  declineButton: { alignItems: 'center', backgroundColor: '#FCE9E5', borderRadius: 9, justifyContent: 'center', minHeight: 38, paddingHorizontal: 12 },
  declineLabel: { color: '#9A3E2A', fontSize: 11, fontWeight: '700' },
  sectionCard: { padding: 16 },
  sectionTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitleGroup: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  smallIcon: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 13, height: 26, justifyContent: 'center', width: 26 },
  cardTitle: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  editButton: { alignItems: 'center', flexDirection: 'row', gap: 5, minHeight: 38, paddingHorizontal: 8 },
  editButtonText: { color: palette.forest, fontSize: 12, fontWeight: '700' },
  facts: { gap: 2 },
  factRow: { alignItems: 'center', borderBottomColor: palette.line, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 42 },
  factLabel: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  factValue: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  listFact: { borderBottomColor: palette.line, borderBottomWidth: 1, paddingVertical: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  tag: { backgroundColor: palette.paper, borderRadius: 8, color: palette.ink, fontSize: 11, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6 },
  cautionTag: { backgroundColor: palette.dangerBg, color: palette.dangerText },
  emptyFact: { color: palette.muted, fontSize: 11, marginTop: 5 },
  form: { gap: 2 },
  fieldLabel: { color: palette.ink, fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 12 },
  fieldHint: { color: palette.muted, fontSize: 10, fontWeight: '400' },
  input: { backgroundColor: palette.paper, borderColor: 'transparent', borderRadius: 9, borderWidth: 1, color: palette.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 76 },
  bloodTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  bloodType: { alignItems: 'center', backgroundColor: palette.paper, borderRadius: 8, justifyContent: 'center', minHeight: 34, minWidth: 44, paddingHorizontal: 9 },
  bloodTypeSelected: { backgroundColor: palette.forest },
  bloodTypeText: { color: palette.ink, fontSize: 11, fontWeight: '700' },
  bloodTypeTextSelected: { color: palette.white },
  disabled: { opacity: 0.55 },
  contactRow: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  emptyCopy: { color: palette.muted, flex: 1, fontSize: 12, lineHeight: 18 },
  doctorRow: { alignItems: 'center', flexDirection: 'row', gap: 10, padding: 13 },
  starButton: { alignItems: 'center', height: 38, justifyContent: 'center', width: 34 },
  revokeButton: { alignItems: 'center', backgroundColor: '#FCE9E5', borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  removeButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  historyBlock: { backgroundColor: palette.paper, borderRadius: 12, gap: 8, marginTop: 13, padding: 13 },
  historyTitle: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  historyRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  historyName: { color: palette.muted, flex: 1, fontSize: 11 },
  historyDate: { color: palette.muted, fontSize: 10 },
  emptyLine: { alignItems: 'center', backgroundColor: palette.white, borderRadius: 12, flexDirection: 'row', gap: 10, minHeight: 62, paddingHorizontal: 14 },
  appointmentEmpty: { alignItems: 'center', flexDirection: 'row', gap: 11, padding: 14 },
  appointmentIcon: { alignItems: 'center', backgroundColor: palette.sky, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  appointmentCopy: { flex: 1 },
  privacyNote: { alignItems: 'flex-start', flexDirection: 'row', gap: 9, marginTop: 22, paddingHorizontal: 2 },
  privacyText: { color: palette.muted, flex: 1, fontSize: 11, lineHeight: 17 },
}));
