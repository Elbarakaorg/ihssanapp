import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as ExpoLinking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ScanLine, X } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-provider';
import { supabaseClient } from '@/platform/supabase/client';
import { palette, themedStyles, useScheme } from '@/ui/palette';

const urlPattern = /^https?:\/\//i;

export default function QrScanScreen() {
  useScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<BarcodeScanningResult | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const [isShareCode, setIsShareCode] = useState(false);
  const [claimSucceeded, setClaimSucceeded] = useState(false);

  const handleScan = async (result: BarcodeScanningResult) => {
    setScanned(result);
    setShareMessage('');
    setClaimSucceeded(false);
    const parsed = ExpoLinking.parse(result.data);
    const parsedRoute = `${parsed.hostname ?? ''}/${parsed.path ?? ''}`.replace(/^\/+|\/+$/g, '');
    const directRoute = parsed.path?.replace(/^\/+|\/+$/g, '');
    const token = parsed.scheme === 'ihssan' && (parsedRoute === 'share/profile' || directRoute === 'share/profile')
      ? parsed.queryParams?.token
      : null;
    if (typeof token !== 'string') {
      setIsShareCode(false);
      return;
    }

    setIsShareCode(true);
    if (!session || !supabaseClient) {
      setShareMessage('Sign in with a verified clinician account to request access.');
      return;
    }

    const { error } = await supabaseClient.rpc('claim_patient_profile_share_code', { p_share_code: token });
    setClaimSucceeded(!error);
    setShareMessage(error
      ? error.message
      : 'Request sent. The patient must approve the exact information they want to share.');
  };

  const openLink = () => {
    if (!isShareCode && scanned?.data && urlPattern.test(scanned.data)) void Linking.openURL(scanned.data);
  };

  return (
    <View style={styles.container}>
      {permission?.granted ? (
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleScan}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.permissionState}>
          <ScanLine color={palette.white} size={38} strokeWidth={1.6} />
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>Allow camera access to scan a QR code.</Text>
          <Pressable accessibilityRole="button" onPress={() => void requestPermission()} style={styles.permissionButton}>
            <Text style={styles.permissionButtonLabel}>Allow camera access</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable accessibilityLabel="Close scanner" accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
          <X color={palette.white} size={20} />
        </Pressable>
        <Text style={styles.topBarTitle}>Scan QR code</Text>
        <View style={styles.closeButton} />
      </View>

      {permission?.granted && !scanned ? <View style={styles.frame} /> : null}

      {scanned ? (
        <View style={[styles.resultCard, { marginBottom: insets.bottom + 24 }]}>
          <Text style={styles.resultLabel}>Scanned</Text>
          <Text numberOfLines={3} style={styles.resultValue}>{isShareCode ? (shareMessage || 'Sending access request…') : scanned.data}</Text>
          <View style={styles.resultActions}>
            {isShareCode && claimSucceeded ? <Pressable accessibilityRole="button" onPress={() => router.push('/my-patients')} style={styles.primaryButton}><Text style={styles.primaryButtonLabel}>My patients</Text></Pressable> : null}
            {!isShareCode && urlPattern.test(scanned.data) ? (
              <Pressable accessibilityRole="button" onPress={openLink} style={styles.primaryButton}>
                <Text style={styles.primaryButtonLabel}>Open link</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => { setScanned(null); setShareMessage(''); setIsShareCode(false); setClaimSucceeded(false); }} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>Scan again</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: {
    backgroundColor: '#0B120E',
    flex: 1,
  },
  permissionState: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permissionTitle: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  permissionBody: {
    color: '#C7D2CC',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: palette.forest,
    borderRadius: 11,
    marginTop: 12,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  permissionButtonLabel: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  topBarTitle: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '700',
  },
  frame: {
    alignSelf: 'center',
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24,
    borderWidth: 2,
    height: 240,
    position: 'absolute',
    top: '32%',
    width: 240,
  },
  resultCard: {
    backgroundColor: palette.white,
    borderRadius: 18,
    bottom: 0,
    marginHorizontal: 16,
    padding: 18,
    position: 'absolute',
    width: '100%',
    alignSelf: 'center',
  },
  resultLabel: {
    color: palette.forest,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  resultValue: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.forest,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  primaryButtonLabel: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  secondaryButtonLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
}));
