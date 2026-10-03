import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, KeyRound, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { getClinicianVerificationStatus } from '@/features/profile/profile-repository';
import {
  acceptShareInvite,
  formatShareCode,
  normalizeShareCode,
  previewShareInvite,
  type SharePreview,
} from '@/features/profile/share-invite';
import { Page, uiStyles } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';

function Facts({ label, values }: { label: string; values: string[] | null }) {
  if (!values?.length) return null;
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{values.join(', ')}</Text></View>;
}

export default function AcceptShareScreen() {
  useScheme();
  const router = useRouter();
  const { session, isReady } = useAuth();
  const { code: linkedCode } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(typeof linkedCode === 'string' ? formatShareCode(linkedCode) : '');
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const autoLookedUp = useRef(false);

  useEffect(() => {
    if (!session) return;
    void getClinicianVerificationStatus().then((status) => setVerified(status === 'verified')).catch(() => setVerified(false));
  }, [session]);

  const lookup = async (value = code) => {
    if (normalizeShareCode(value).length !== 12) {
      setError('Enter the 12-character code from your patient.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await previewShareInvite(value);
      setPreview(result);
      if (!result) setError('This code is invalid, expired or was already used. Ask the patient for a new one.');
    } catch (lookupError) {
      setPreview(null);
      setError(lookupError instanceof Error ? lookupError.message : 'Could not check this code.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (verified && !autoLookedUp.current && normalizeShareCode(code).length === 12) {
      autoLookedUp.current = true;
      void lookup(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const grantId = await acceptShareInvite(code);
      router.replace(`/my-patients/${grantId}` as Href);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this patient.');
      setBusy(false);
    }
  };

  const back = (
    <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/my-patients' as Href))} style={styles.back}>
      <ArrowLeft color={palette.ink} size={18} /><Text style={styles.backLabel}>My patients</Text>
    </Pressable>
  );

  if (!isReady) return <Page>{back}<ActivityIndicator color={palette.forest} /></Page>;

  if (!session) {
    return (
      <Page>
        {back}
        <Text style={styles.title}>Add a patient</Text>
        <Text style={styles.body}>Sign in with your verified clinician account to open this patient code.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/auth' as Href)} style={styles.primary}><Text style={styles.primaryLabel}>Sign in</Text></Pressable>
      </Page>
    );
  }

  if (verified === false) {
    return (
      <Page>
        {back}
        <Text style={styles.title}>Verification required</Text>
        <Text style={styles.body}>Only verified clinicians can add patients. Your code stays valid until it expires, so you can come back after verification.</Text>
      </Page>
    );
  }

  return (
    <Page>
      {back}
      <Text style={styles.title}>Add a patient</Text>
      <Text style={styles.body}>Enter the code your patient shared, or open their link. You can review what they shared before saving.</Text>

      <View style={styles.inputRow}>
        <KeyRound color={palette.muted} size={18} />
        <TextInput
          accessibilityLabel="Patient share code"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={14}
          onChangeText={(value) => { setCode(formatShareCode(value)); setPreview(null); setError(''); }}
          onSubmitEditing={() => void lookup()}
          placeholder="XXXX-XXXX-XXXX"
          placeholderTextColor={palette.muted}
          style={styles.input}
          value={code}
        />
      </View>
      {!preview ? (
        <Pressable accessibilityRole="button" disabled={busy || verified === null} onPress={() => void lookup()} style={[styles.primary, (busy || verified === null) && styles.disabled]}>
          {busy ? <ActivityIndicator color={palette.white} /> : <Text style={styles.primaryLabel}>View patient profile</Text>}
        </Pressable>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      {preview ? (
        <View style={[uiStyles.card, styles.previewCard]}>
          <View style={styles.previewHead}>
            <View style={styles.badge}><ShieldCheck color={palette.forest} size={18} /></View>
            <View style={styles.previewCopy}>
              <Text style={styles.name}>{preview.patient_name}</Text>
              <Text style={styles.scope}>Shared: {[preview.share_medical_profile && 'Medical profile', preview.share_measurements && 'Measurements'].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          {preview.share_medical_profile ? (
            <>
              {preview.date_of_birth ? <View style={styles.fact}><Text style={styles.factLabel}>Date of birth</Text><Text style={styles.factValue}>{preview.date_of_birth}</Text></View> : null}
              {preview.blood_type ? <View style={styles.fact}><Text style={styles.factLabel}>Blood type</Text><Text style={styles.factValue}>{preview.blood_type}</Text></View> : null}
              <Facts label="Allergies" values={preview.allergies} />
              <Facts label="Conditions" values={preview.conditions} />
              <Facts label="Medications" values={preview.medications} />
              <Facts label="Surgeries" values={preview.surgeries} />
              {preview.emergency_contact_name ? <View style={styles.fact}><Text style={styles.factLabel}>Emergency contact</Text><Text style={styles.factValue}>{[preview.emergency_contact_name, preview.emergency_contact_relation, preview.emergency_contact_phone].filter(Boolean).join(' · ')}</Text></View> : null}
            </>
          ) : null}
          {preview.share_measurements ? <Text style={styles.note}>Measurement history becomes available after you save this patient.</Text> : null}
          {preview.already_saved ? <Text style={styles.note}>This patient is already in your list. Saving updates what they share.</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={[styles.primary, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color={palette.white} /> : <><Check color={palette.white} size={16} /><Text style={styles.primaryLabel}>Save to my patients</Text></>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setPreview(null); setCode(''); }} style={styles.secondary}><Text style={styles.secondaryLabel}>Don't save</Text></Pressable>
        </View>
      ) : null}
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 20, minHeight: 42 },
  backLabel: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  title: { color: palette.ink, fontSize: 29, fontWeight: '700' },
  body: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  inputRow: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 20, paddingHorizontal: 14 },
  input: { color: palette.ink, flex: 1, fontSize: 18, fontVariant: ['tabular-nums'], letterSpacing: 2, minHeight: 52 },
  primary: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 12, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 16, minHeight: 50 },
  primaryLabel: { color: palette.white, fontSize: 14, fontWeight: '700' },
  secondary: { alignItems: 'center', justifyContent: 'center', marginTop: 6, minHeight: 44 },
  secondaryLabel: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  error: { backgroundColor: '#FCE9E5', borderRadius: 10, color: '#9A3E2A', fontSize: 12, lineHeight: 18, marginTop: 14, padding: 12 },
  previewCard: { gap: 10, marginTop: 20, padding: 16 },
  previewHead: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  badge: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  previewCopy: { flex: 1 },
  name: { color: palette.ink, fontSize: 17, fontWeight: '700' },
  scope: { color: palette.forest, fontSize: 11, fontWeight: '600', marginTop: 3 },
  fact: { borderTopColor: palette.line, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9 },
  factLabel: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  factValue: { color: palette.ink, fontSize: 13, lineHeight: 19, marginTop: 2 },
  note: { color: palette.muted, fontSize: 12, lineHeight: 18 },
}));
