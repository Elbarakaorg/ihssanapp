import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { ArrowRight, Clock3, KeyRound, LockKeyhole, QrCode, UsersRound } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { listMyPatientProfiles, type AuthorizedPatient } from '@/features/profile/clinician-patients-repository';
import { getClinicianVerificationStatus } from '@/features/profile/profile-repository';
import { Page, PageHeading, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';
import { Loading } from '@/ui/loading';

export default function ClinicianPatientsScreen() {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const [patients, setPatients] = useState<AuthorizedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'rejected' | 'suspended' | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    const refresh = async () => {
      try {
        const status = await getClinicianVerificationStatus();
        if (active) setVerificationStatus(status);
        if (status !== 'verified') {
          if (active) setPatients([]);
          return;
        }
        const rows = await listMyPatientProfiles();
        if (active) setPatients(rows);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your patient history.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session]));

  const activePatients = patients.filter((patient) => !patient.revoked_at);
  const pastPatients = patients.filter((patient) => patient.revoked_at);

  return (
    <Page>
      <PreviewNotice />
      <PageHeading eyebrow="Clinician workspace" title="My patients">
        Patient profiles you can access appear here after the patient approves your request. There is no global patient search.
      </PageHeading>

      <Pressable accessibilityRole="button" disabled={verificationStatus !== 'verified'} onPress={() => router.push('/scan')} style={[styles.scanButton, verificationStatus !== 'verified' && styles.scanDisabled]}>
        <View style={styles.scanIcon}><QrCode color={palette.white} size={20} /></View>
        <View style={styles.scanCopy}><Text style={styles.scanTitle}>Scan patient QR</Text><Text style={styles.scanDetail}>Request access to a patient-approved profile</Text></View>
        <ArrowRight color={palette.forest} size={19} />
      </Pressable>

      <Pressable accessibilityRole="button" disabled={verificationStatus !== 'verified'} onPress={() => router.push('/share/accept' as Href)} style={[styles.scanButton, verificationStatus !== 'verified' && styles.scanDisabled]}>
        <View style={styles.scanIcon}><KeyRound color={palette.white} size={20} /></View>
        <View style={styles.scanCopy}><Text style={styles.scanTitle}>Enter a patient code</Text><Text style={styles.scanDetail}>Preview a profile shared with a code or link, then save it</Text></View>
        <ArrowRight color={palette.forest} size={19} />
      </Pressable>

      {!loading && verificationStatus !== 'verified' ? <View style={styles.verificationNotice}>
        <Text style={styles.verificationTitle}>{verificationStatus === 'pending' ? 'Clinician verification pending' : verificationStatus === 'suspended' ? 'Clinician access suspended' : verificationStatus === 'rejected' ? 'Clinician verification not approved' : 'Clinician verification required'}</Text>
        <Text style={styles.emptyText}>{verificationStatus === 'pending' ? 'Your account is ready, but patient QR scanning becomes available after Ihssan verifies your professional credentials.' : 'Patient profiles are available only to verified clinicians. Contact Ihssan support if you need help with verification.'}</Text>
      </View> : null}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <SectionHeading title="Authorized profiles" detail={`${activePatients.length} active`} />
      {loading ? <Loading label="Loading authorized profiles" /> : verificationStatus !== 'verified' ? null : activePatients.length ? (
        <View style={styles.list}>{activePatients.map((patient) => <Pressable accessibilityRole="button" key={patient.grant_id} onPress={() => router.push(`/my-patients/${patient.grant_id}` as Href)} style={[uiStyles.card, styles.patientRow]}>
          <View style={styles.patientAvatar}><UsersRound color={palette.forest} size={19} /></View>
          <View style={styles.patientCopy}>
            <Text style={styles.patientName}>{patient.patient_name}</Text>
            <Text style={styles.patientScope}>{patient.access_scope.medical_profile ? 'Medical profile' : ''}{patient.access_scope.medical_profile && patient.access_scope.measurements ? ' · ' : ''}{patient.access_scope.measurements ? 'Measurements' : ''}</Text>
            <View style={styles.lastAccess}><Clock3 color={palette.muted} size={12} /><Text style={styles.lastAccessText}>{patient.last_accessed_at ? `Last viewed ${formatDate(patient.last_accessed_at)}` : 'Not viewed yet'}</Text></View>
          </View>
          <ArrowRight color={palette.muted} size={17} />
        </Pressable>)}</View>
      ) : <View style={styles.emptyState}><View style={styles.emptyIcon}><LockKeyhole color={palette.forest} size={20} /></View><Text style={styles.emptyTitle}>No shared profiles yet</Text><Text style={styles.emptyText}>Enter a patient’s share code or scan their QR code. You’ll see their profile only after they have chosen to share it.</Text></View>}

      {pastPatients.length ? <>
        <SectionHeading title="Past access" detail="Revoked by the patient" />
        <View style={styles.list}>{pastPatients.map((patient) => <View key={patient.grant_id} style={[uiStyles.card, styles.pastRow]}>
          <View style={[styles.patientAvatar, styles.pastAvatar]}><LockKeyhole color={palette.muted} size={17} /></View>
          <View style={styles.patientCopy}><Text style={styles.pastName}>{patient.patient_name}</Text><Text style={styles.lastAccessText}>Access revoked · no profile data available</Text></View>
        </View>)}</View>
      </> : null}
    </Page>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const styles = themedStyles(() => StyleSheet.create({
  scanButton: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 14, flexDirection: 'row', gap: 12, marginBottom: 6, padding: 14 },
  scanDisabled: { opacity: 0.55 },
  scanIcon: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  scanCopy: { flex: 1 },
  scanTitle: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  scanDetail: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  verificationNotice: { backgroundColor: palette.sky, borderRadius: 12, marginTop: 12, padding: 14 },
  verificationTitle: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  error: { backgroundColor: '#F3E1D6', borderRadius: 10, color: '#8A4A2C', fontSize: 12, lineHeight: 18, marginTop: 12, padding: 12 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  list: { gap: 9 },
  patientRow: { alignItems: 'center', flexDirection: 'row', gap: 11, padding: 14 },
  patientAvatar: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 21, height: 42, justifyContent: 'center', width: 42 },
  patientCopy: { flex: 1, minWidth: 0 },
  patientName: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  patientScope: { color: palette.forest, fontSize: 10, fontWeight: '600', marginTop: 4 },
  lastAccess: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 6 },
  lastAccessText: { color: palette.muted, fontSize: 10, lineHeight: 15 },
  emptyState: { alignItems: 'center', backgroundColor: palette.white, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 26 },
  emptyIcon: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  emptyTitle: { color: palette.ink, fontSize: 14, fontWeight: '700', marginTop: 10 },
  emptyText: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: 'center' },
  pastRow: { alignItems: 'center', flexDirection: 'row', gap: 11, padding: 12 },
  pastAvatar: { backgroundColor: palette.paper },
  pastName: { color: palette.muted, fontSize: 13, fontWeight: '600' },
}));
