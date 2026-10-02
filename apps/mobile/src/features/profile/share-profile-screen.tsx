import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { Page } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';
import { supabaseClient } from '@/platform/supabase/client';

type ShareCodeResult = { share_code: string; expires_at: string };

export default function ShareProfileScreen() {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const [shareCode, setShareCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createCode = async () => {
    if (!supabaseClient || !session) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: requestError } = await supabaseClient.rpc('create_patient_profile_share_code');
      if (requestError) throw requestError;
      const row = (Array.isArray(data) ? data[0] : data) as ShareCodeResult | null;
      if (!row?.share_code || !row.expires_at) throw new Error('Could not create a share code. Try again.');
      setShareCode(row.share_code);
      setExpiresAt(row.expires_at);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create a share code.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void createCode();
  }, [session]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const updateCountdown = () => setSecondsLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const qrValue = shareCode ? `ihssan://share/profile?token=${encodeURIComponent(shareCode)}` : '';
  const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <Page>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><ArrowLeft color={palette.ink} size={18} /><Text style={styles.backLabel}>Medical profile</Text></Pressable>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Patient-controlled sharing</Text>
        <Text style={styles.title}>Share with a doctor</Text>
        <Text style={styles.description}>Let a verified clinician scan this temporary code to request access. Your information stays private until you approve the request in your medical profile.</Text>
      </View>

      <View style={styles.qrCard}>
        {loading && !qrValue ? <View style={styles.qrLoading}><ActivityIndicator color={palette.forest} /><Text style={styles.body}>Creating a secure code</Text></View> : qrValue ? <QRCode value={qrValue} size={220} color={palette.ink} backgroundColor={palette.white} /> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={styles.expiry}><View style={[styles.expiryDot, secondsLeft === 0 && styles.expiredDot]} /><Text style={styles.expiryText}>{secondsLeft > 0 ? `Code expires in ${countdown}` : 'Code expired'}</Text></View>
        <Text style={styles.qrHint}>This code expires after 10 minutes and can only be used once.</Text>
      </View>

      <View style={styles.privacyCard}>
        <ShieldCheck color={palette.forest} size={20} />
        <View style={styles.privacyCopy}><Text style={styles.privacyTitle}>You stay in control</Text><Text style={styles.privacyBody}>Scanning creates an access request, not access. You choose whether to share your medical profile, measurement history, both, or neither.</Text></View>
      </View>

      <Pressable accessibilityRole="button" disabled={loading || secondsLeft > 0} onPress={() => void createCode()} style={[styles.refreshButton, (loading || secondsLeft > 0) && styles.refreshDisabled]}>
        {loading ? <ActivityIndicator color={palette.forest} /> : <RefreshCw color={palette.forest} size={17} />}
        <Text style={styles.refreshLabel}>{secondsLeft > 0 ? 'Generate another code after expiry' : 'Generate a new code'}</Text>
      </Pressable>
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 20, minHeight: 42 },
  backLabel: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  heading: { marginBottom: 19 },
  eyebrow: { color: palette.forest, fontSize: 12, fontWeight: '600', marginBottom: 7 },
  title: { color: palette.ink, fontSize: 29, fontWeight: '700' },
  description: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  qrCard: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, minHeight: 315, justifyContent: 'center', padding: 20 },
  qrLoading: { alignItems: 'center', gap: 12, height: 220, justifyContent: 'center' },
  body: { color: palette.muted, fontSize: 12 },
  error: { color: '#9A3E2A', fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  expiry: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 18 },
  expiryDot: { backgroundColor: palette.forest, borderRadius: 4, height: 8, width: 8 },
  expiredDot: { backgroundColor: palette.coral },
  expiryText: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  qrHint: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 6, textAlign: 'center' },
  privacyCard: { alignItems: 'flex-start', backgroundColor: palette.leaf, borderRadius: 14, flexDirection: 'row', gap: 11, marginTop: 16, padding: 14 },
  privacyCopy: { flex: 1 },
  privacyTitle: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  privacyBody: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  refreshButton: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 14, minHeight: 46, paddingHorizontal: 14 },
  refreshDisabled: { opacity: 0.45 },
  refreshLabel: { color: palette.forest, fontSize: 12, fontWeight: '700' },
}));
