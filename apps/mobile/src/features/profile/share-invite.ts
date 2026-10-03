import * as ExpoLinking from 'expo-linking';
import { Platform } from 'react-native';

import { supabaseClient } from '@/platform/supabase/client';

export type ShareInvite = { code: string; expiresAt: string };

export type SharePreview = {
  patient_name: string;
  share_medical_profile: boolean;
  share_measurements: boolean;
  expires_at: string;
  already_saved: boolean;
  date_of_birth: string | null;
  blood_type: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  allergies: string[] | null;
  conditions: string[] | null;
  medications: string[] | null;
  surgeries: string[] | null;
};

function requireClient() {
  if (!supabaseClient) throw new Error('Authentication is not configured.');
  return supabaseClient;
}

export function normalizeShareCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 12);
}

export function formatShareCode(value: string) {
  return normalizeShareCode(value).replace(/(.{4})(?=.)/g, '$1-');
}

export function shareInviteLink(code: string) {
  const webBase = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_WEB_URL;
  if (webBase) return `${webBase.replace(/\/$/, '')}/share/accept?code=${encodeURIComponent(code)}`;
  return ExpoLinking.createURL('/share/accept', { queryParams: { code } });
}

export async function createShareInvite(input: { medicalProfile: boolean; measurements: boolean; validHours: number }): Promise<ShareInvite> {
  const { data, error } = await requireClient().rpc('create_patient_share_invite', {
    p_share_medical_profile: input.medicalProfile,
    p_share_measurements: input.measurements,
    p_valid_hours: input.validHours,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { code: string; expires_at: string } | null;
  if (!row?.code) throw new Error('Could not create a share code. Try again.');
  return { code: row.code, expiresAt: row.expires_at };
}

export async function revokeMyShareInvites() {
  const { error } = await requireClient().rpc('revoke_my_patient_share_invites');
  if (error) throw error;
}

export async function previewShareInvite(code: string): Promise<SharePreview | null> {
  const { data, error } = await requireClient().rpc('preview_patient_share_invite', { p_code: code });
  if (error) throw error;
  return ((Array.isArray(data) ? data[0] : data) ?? null) as SharePreview | null;
}

export async function acceptShareInvite(code: string): Promise<string> {
  const { data, error } = await requireClient().rpc('accept_patient_share_invite', { p_code: code });
  if (error) throw error;
  if (!data) throw new Error('This code is invalid, expired or already used.');
  return data as string;
}
