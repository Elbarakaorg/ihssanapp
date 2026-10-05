import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Copy, Link2, RefreshCw, Share2, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { ActivityIndicator, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { ThinkingOrb } from '@/ui/thinking-orb';
import { Page } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { supabaseClient } from '@/platform/supabase/client';
import { createShareInvite, revokeMyShareInvites, shareInviteLink, type ShareInvite } from './share-invite';

type ShareCodeResult = { share_code: string; expires_at: string };

export default function ShareProfileScreen() {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const [shareCode, setShareCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [shareProfile, setShareProfile] = useState(true);
  const [shareMeasurements, setShareMeasurements] = useState(false);
  const [invite, setInvite] = useState<ShareInvite | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');

  const createInvite = async () => {
    setInviteBusy(true);
    setInviteMessage('');
    try {
      setInvite(await createShareInvite({ medicalProfile: shareProfile, measurements: shareMeasurements, validHours: 24 }));
    } catch (inviteError) {
      setInviteMessage(inviteError instanceof Error ? inviteError.message : 'Could not create a code.');
    } finally {
      setInviteBusy(false);
    }
  };

  const stopSharing = async () => {
    setInviteBusy(true);
    try {
      await revokeMyShareInvites();
      setInvite(null);
      setInviteMessage('Code revoked. It no longer works.');
    } catch (revokeError) {
      setInviteMessage(revokeError instanceof Error ? revokeError.message : 'Could not revoke the code.');
    } finally {
      setInviteBusy(false);
    }
  };

  const copyText = async (text: string, done: string) => {
    await Clipboard.setStringAsync(text);
    setInviteMessage(done);
  };

  const shareInvite = async () => {
    if (!invite) return;
    const link = shareInviteLink(invite.code);
    const message = `Ihssan patient code: ${invite.code}\nOpen with a verified clinician account: ${link}`;
    try {
      await Share.share({ message });
    } catch {
      await copyText(message, 'Code and link copied.');
    }
  };

  const userId = session?.identity.id;

  // force=false resumes the active code (page reloads reuse it); force=true is only for the explicit button.
  const loadCode = async (force: boolean) => {
    if (!supabaseClient || !userId) return;
    setLoading(true);
    setError('');
    try {
      let { data, error: requestError } = await supabaseClient.rpc('get_or_create_patient_profile_share_code', { p_force: force });
      // Older databases without the resumable-code migration still work with the original function.
      if (requestError?.code === 'PGRST202') ({ data, error: requestError } = await supabaseClient.rpc('create_patient_profile_share_code'));
      if (requestError) throw new Error(requestError.message);
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

  // Keyed on the user id, not the session object, so token refreshes never mint a new code.
  useEffect(() => {
    void loadCode(false);
  }, [userId]);

  // Re-render every second; the remaining time is derived from expiresAt so there is no stale first frame.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = setInterval(() => {
      setTick((tick) => tick + 1);
      if (new Date(expiresAt).getTime() <= Date.now()) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  const secondsLeft = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;

  const qrValue = shareCode && expiresAt && secondsLeft > 0 ? `ihssan://share/profile?token=${encodeURIComponent(shareCode)}` : '';
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
        {loading && !qrValue ? <View style={styles.qrLoading}><ThinkingOrb state="connecting" size={64} label="Creating a secure code" /><Text style={styles.body}>Creating a secure code</Text></View> : qrValue ? <Animated.View key={shareCode} entering={FadeIn.duration(150)}><QRCode value={qrValue} size={220} color={palette.ink} backgroundColor={palette.white} /></Animated.View> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {!loading && !qrValue ? (
          <Pressable accessibilityRole="button" onPress={() => void loadCode(false)} style={styles.createButton}>
            <Text style={styles.createLabel}>{error ? 'Try again' : 'Generate new code'}</Text>
          </Pressable>
        ) : null}
        <View style={styles.expiry}><View style={[styles.expiryDot, !!expiresAt && secondsLeft === 0 && styles.expiredDot]} /><Text style={styles.expiryText}>{!expiresAt ? (loading ? 'Creating code' : 'No active code') : secondsLeft > 0 ? `Code expires in ${countdown}` : 'Code expired'}</Text></View>
        <Text style={styles.qrHint}>This code is valid for 30 minutes and can only be used once. Reopening this page reuses it.</Text>
      </View>

      <View style={styles.inviteCard}>
        <View style={styles.inviteHead}><Link2 color={palette.forest} size={18} /><Text style={styles.inviteTitle}>Share by code or link</Text></View>
        <Text style={styles.body}>Create a code for a verified doctor. They can preview what you share and choose to save you as a patient. Valid for 24 hours, one use.</Text>
        {invite ? (
          <>
            <Text accessibilityLabel={`Share code ${invite.code}`} selectable adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.codeText}>{invite.code}</Text>
            <View style={styles.inviteActions}>
              <Pressable accessibilityRole="button" onPress={() => void copyText(invite.code, 'Code copied.')} style={styles.chipButton}><Copy color={palette.forest} size={14} /><Text style={styles.chipLabel}>Copy code</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => void copyText(shareInviteLink(invite.code), 'Link copied.')} style={styles.chipButton}><Link2 color={palette.forest} size={14} /><Text style={styles.chipLabel}>Copy link</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => void shareInvite()} style={styles.chipButton}><Share2 color={palette.forest} size={14} /><Text style={styles.chipLabel}>Share</Text></Pressable>
            </View>
            <Pressable accessibilityRole="button" disabled={inviteBusy} onPress={() => void stopSharing()} style={styles.revokeButton}><Text style={styles.revokeLabel}>Revoke this code</Text></Pressable>
          </>
        ) : (
          <>
            <View style={styles.toggleRow}><Text style={styles.toggleLabel}>Medical profile</Text><Switch accessibilityLabel="Share medical profile" onValueChange={setShareProfile} value={shareProfile} /></View>
            <View style={styles.toggleRow}><Text style={styles.toggleLabel}>Measurement history</Text><Switch accessibilityLabel="Share measurement history" onValueChange={setShareMeasurements} value={shareMeasurements} /></View>
            <Pressable accessibilityRole="button" disabled={inviteBusy || (!shareProfile && !shareMeasurements)} onPress={() => void createInvite()} style={[styles.createButton, (inviteBusy || (!shareProfile && !shareMeasurements)) && styles.refreshDisabled]}>
              {inviteBusy ? <ActivityIndicator color={palette.white} /> : <Text style={styles.createLabel}>Create code</Text>}
            </Pressable>
          </>
        )}
        {inviteMessage ? <Text accessibilityRole="alert" style={styles.inviteMessage}>{inviteMessage}</Text> : null}
      </View>

      <View style={styles.privacyCard}>
        <ShieldCheck color={palette.forest} size={20} />
        <View style={styles.privacyCopy}><Text style={styles.privacyTitle}>You stay in control</Text><Text style={styles.privacyBody}>Scanning creates an access request, not access. You choose whether to share your medical profile, measurement history, both, or neither.</Text></View>
      </View>

      <Pressable accessibilityRole="button" disabled={loading} onPress={() => void loadCode(true)} style={[styles.refreshButton, loading && styles.refreshDisabled]}>
        {loading ? <ActivityIndicator color={palette.forest} /> : <RefreshCw color={palette.forest} size={17} />}
        <Text style={styles.refreshLabel}>{secondsLeft > 0 ? 'Replace with a new code' : 'Generate a new code'}</Text>
      </Pressable>
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 20, minHeight: 42 },
  backLabel: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  heading: { marginBottom: 19 },
  eyebrow: { color: palette.forest, fontSize: 12, fontWeight: '600', marginBottom: 7 },
  title: { ...display, color: palette.ink, fontSize: 29 },
  description: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  qrCard: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, minHeight: 315, justifyContent: 'center', padding: 20 },
  qrLoading: { alignItems: 'center', gap: 12, height: 220, justifyContent: 'center' },
  body: { color: palette.muted, fontSize: 12 },
  error: { color: '#8A4A2C', fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  expiry: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 18 },
  expiryDot: { backgroundColor: palette.forest, borderRadius: 4, height: 8, width: 8 },
  expiredDot: { backgroundColor: palette.coral },
  expiryText: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  qrHint: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 6, textAlign: 'center' },
  inviteCard: { backgroundColor: palette.white, borderColor: palette.line, borderRadius: 18, borderWidth: 1, gap: 10, marginTop: 16, padding: 16 },
  inviteHead: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  inviteTitle: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  codeText: { color: palette.ink, fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '700', letterSpacing: 3, textAlign: 'center', paddingVertical: 8 },
  inviteActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chipButton: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 18, flexDirection: 'row', gap: 6, minHeight: 36, paddingHorizontal: 12 },
  chipLabel: { color: palette.forest, fontSize: 12, fontWeight: '700' },
  revokeButton: { alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  revokeLabel: { color: '#8A4A2C', fontSize: 12, fontWeight: '700' },
  toggleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  toggleLabel: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  createButton: { alignItems: 'center', alignSelf: 'stretch', marginTop: 12, backgroundColor: palette.forest, borderRadius: 12, justifyContent: 'center', minHeight: 46 },
  createLabel: { color: palette.white, fontSize: 14, fontWeight: '700' },
  inviteMessage: { color: palette.muted, fontSize: 12, textAlign: 'center' },
  privacyCard: { alignItems: 'flex-start', backgroundColor: palette.leaf, borderRadius: 14, flexDirection: 'row', gap: 11, marginTop: 16, padding: 14 },
  privacyCopy: { flex: 1 },
  privacyTitle: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  privacyBody: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  refreshButton: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 14, minHeight: 46, paddingHorizontal: 14 },
  refreshDisabled: { opacity: 0.45 },
  refreshLabel: { color: palette.forest, fontSize: 12, fontWeight: '700' },
}));
