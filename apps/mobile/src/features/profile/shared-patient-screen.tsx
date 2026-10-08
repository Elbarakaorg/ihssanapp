import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarDays, Droplets, HeartPulse, Pill, ShieldCheck, UserRound } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SharedTreatmentsSection } from '@/features/medicine/shared-treatments-section';
import { PatientNotesSection } from '@/features/doctor/patient-notes-section';
import { getMySharedPatientProfile, listSharedPatientMeasurements, type SharedMeasurement, type SharedPatientProfile } from '@/features/profile/clinician-patients-repository';
import { Page, PageHeading, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme, glassSurface } from '@/ui/palette';
import { Loading } from '@/ui/loading';

export default function SharedPatientScreen() {
  useScheme();
  const { grantId = '' } = useLocalSearchParams<{ grantId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<SharedPatientProfile | null>(null);
  const [measurements, setMeasurements] = useState<SharedMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    setProfile(null);
    setMeasurements([]);
    void getMySharedPatientProfile(grantId).then(async (nextProfile) => {
      if (!active) return;
      setProfile(nextProfile);
      if (nextProfile.access_scope.measurements) {
        const rows = await listSharedPatientMeasurements(grantId);
        if (active) setMeasurements(rows);
      }
    }).catch(() => {
      if (active) setError('This patient profile is no longer available. Access may have been revoked or suspended. No patient data was loaded.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [grantId]));

  return (
    <Page>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><ArrowLeft color={palette.ink} size={18} /><Text style={styles.backLabel}>My patients</Text></Pressable>
      {loading ? <Loading label="Revalidating patient access" state="connecting" /> : error ? <View style={styles.unavailable}><ShieldCheck color={palette.muted} size={24} /><Text style={styles.unavailableTitle}>Profile unavailable</Text><Text style={styles.body}>{error}</Text></View> : profile ? <>
        <PageHeading eyebrow="Patient-approved access" title={profile.patient_name}>
          Shared on {formatDate(profile.granted_at)}. Access is checked each time this profile opens.
        </PageHeading>

        {profile.access_scope.medical_profile ? <>
          <SectionHeading title="Medical essentials" />
          <View style={[uiStyles.card, styles.card]}>
            <Fact icon={CalendarDays} label="Date of birth" value={profile.date_of_birth ? formatDateOnly(profile.date_of_birth) : 'Not provided'} />
            <Fact icon={Droplets} label="Blood type" value={profile.blood_type || 'Not provided'} />
            <ListFact icon={HeartPulse} label="Allergies" values={profile.allergies ?? []} empty="None recorded" caution />
            <ListFact icon={HeartPulse} label="Conditions" values={profile.conditions ?? []} empty="None recorded" />
            <ListFact icon={Pill} label="Medications" values={profile.medications ?? []} empty="None recorded" />
            <ListFact icon={HeartPulse} label="Surgeries and procedures" values={profile.surgeries ?? []} empty="None recorded" />
          </View>
          <SectionHeading title="Emergency contact" />
          <View style={[uiStyles.card, styles.card]}>
            {profile.emergency_contact_name || profile.emergency_contact_phone ? <>
              <Text style={styles.patientName}>{profile.emergency_contact_name || 'Contact'}</Text>
              <Text style={styles.body}>{[profile.emergency_contact_relation, profile.emergency_contact_phone].filter(Boolean).join(' · ')}</Text>
            </> : <Text style={styles.body}>No emergency contact provided.</Text>}
          </View>
        </> : null}

        {profile.access_scope.medical_profile ? <SharedTreatmentsSection grantId={grantId} /> : null}

        {profile.access_scope.measurements ? <>
          <SectionHeading title="Measurement history" detail={`${measurements.length} recent`} />
          {measurements.length ? <View style={styles.measurementList}>{measurements.map((measurement) => <View key={measurement.id} style={[uiStyles.card, styles.measurementRow]}>
            <View style={styles.measurementCopy}><Text style={styles.measurementName}>{measurement.metric_definition?.display_names.en ?? measurement.metric_definition?.metric_key ?? 'Health measurement'}</Text><Text style={styles.body}>{formatDate(measurement.measured_at)} · {measurement.source_label ?? sourceLabel(measurement.source_kind)}</Text></View>
            <Text style={styles.measurementValue}>{formatMeasurement(measurement)}</Text>
          </View>)}</View> : <View style={styles.empty}><Text style={styles.body}>No measurements are available in the shared history.</Text></View>}
        </> : <View style={styles.scopeNote}><ShieldCheck color={palette.forest} size={17} /><Text style={styles.scopeText}>The patient shared their medical profile, but not measurement history.</Text></View>}

        <PatientNotesSection grantId={grantId} />

        <View style={styles.privacyNote}><ShieldCheck color={palette.forest} size={17} /><Text style={styles.privacyText}>Access is limited to the categories the patient approved. Do not save or share this information outside the authorized care relationship.</Text></View>
      </> : null}
    </Page>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  useScheme();
  return <View style={styles.factRow}><View style={styles.factLabel}><Icon color={palette.forest} size={15} /><Text style={styles.factLabelText}>{label}</Text></View><Text style={styles.factValue}>{value}</Text></View>;
}

function ListFact({ icon: Icon, label, values, empty, caution = false }: { icon: typeof UserRound; label: string; values: string[]; empty: string; caution?: boolean }) {
  useScheme();
  return <View style={styles.listFact}>
    <View style={styles.factLabel}><Icon color={caution ? palette.coral : palette.forest} size={15} /><Text style={styles.factLabelText}>{label}</Text></View>
    {values.length ? <Text style={[styles.listValue, caution && styles.caution]}>{values.join(', ')}</Text> : <Text style={styles.body}>{empty}</Text>}
  </View>;
}

function formatMeasurement(measurement: SharedMeasurement) {
  const value = measurement.component_values
    ? `${measurement.component_values.systolic ?? '—'} / ${measurement.component_values.diastolic ?? '—'}`
    : measurement.numeric_value ?? '—';
  return `${value}${measurement.unit ? ` ${measurement.unit}` : measurement.component_values ? ' mm Hg' : ''}`;
}

function sourceLabel(kind: string) {
  if (kind === 'clinician_entry') return 'Clinician-entered';
  if (kind === 'document_scan') return 'Scanned document';
  return 'Patient-entered';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateOnly(value: string) {
  return formatDate(`${value}T12:00:00`);
}

const styles = themedStyles(() => StyleSheet.create({
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 17, minHeight: 42 },
  backLabel: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  loading: { alignItems: 'center', gap: 10, marginTop: 65 },
  body: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  unavailable: { alignItems: 'center', ...glassSurface(), borderRadius: 14, marginTop: 30, padding: 24 },
  unavailableTitle: { color: palette.ink, fontSize: 16, fontWeight: '700', marginTop: 8 },
  card: { gap: 2, padding: 15 },
  factRow: { alignItems: 'center', borderBottomColor: palette.line, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 42 },
  factLabel: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  factLabelText: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  factValue: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  listFact: { borderBottomColor: palette.line, borderBottomWidth: 1, gap: 6, paddingVertical: 9 },
  listValue: { color: palette.ink, fontSize: 12, lineHeight: 18, paddingLeft: 22 },
  caution: { color: palette.dangerText },
  patientName: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  measurementList: { gap: 8 },
  measurementRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between', padding: 13 },
  measurementCopy: { flex: 1, minWidth: 0 },
  measurementName: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  measurementValue: { color: palette.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  empty: { ...glassSurface(), borderRadius: 12, padding: 14 },
  scopeNote: { alignItems: 'flex-start', backgroundColor: palette.leaf, borderRadius: 12, flexDirection: 'row', gap: 9, marginTop: 14, padding: 13 },
  scopeText: { color: palette.ink, flex: 1, fontSize: 11, lineHeight: 17 },
  privacyNote: { alignItems: 'flex-start', flexDirection: 'row', gap: 9, marginTop: 20 },
  privacyText: { color: palette.muted, flex: 1, fontSize: 11, lineHeight: 17 },
}));
