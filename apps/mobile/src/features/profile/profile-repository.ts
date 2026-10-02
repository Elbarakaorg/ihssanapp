import { supabaseClient } from '@/platform/supabase/client';

export type AccountProfile = {
  id: string;
  display_name: string;
  bio: string;
  avatar_path: string | null;
  preferred_locale: 'ar' | 'fr' | 'en';
  profile_type: 'patient' | 'clinician';
  setup_completed_at: string | null;
};

export type ProfileChanges = {
  displayName: string;
  bio: string;
};

export async function getCurrentUserProfile(): Promise<AccountProfile> {
  if (!supabaseClient) throw new Error('Authentication is not configured.');

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must sign in to access your profile.');

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, display_name, bio, avatar_path, preferred_locale, profile_type, setup_completed_at')
    .eq('id', userData.user.id)
    .single();

  if (error) throw error;
  return data as AccountProfile;
}

export async function updateCurrentUserProfile(changes: ProfileChanges): Promise<AccountProfile> {
  if (!supabaseClient) throw new Error('Authentication is not configured.');

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must sign in to update your profile.');

  const displayName = changes.displayName.trim();
  const bio = changes.bio.trim();
  if (displayName.length < 2 || displayName.length > 80) throw new Error('Display name must be between 2 and 80 characters.');
  if (bio.length > 500) throw new Error('Bio must be 500 characters or fewer.');

  const { data, error } = await supabaseClient
    .from('profiles')
    .update({ display_name: displayName, bio })
    .eq('id', userData.user.id)
    .select('id, display_name, bio, avatar_path, preferred_locale, profile_type, setup_completed_at')
    .single();

  if (error || !data) throw error ?? new Error('Could not update your profile.');
  return data as AccountProfile;
}

export async function uploadCurrentUserAvatar(image: { base64: string; extension: 'jpg' | 'png' | 'webp'; contentType: string }): Promise<AccountProfile> {
  if (!supabaseClient) throw new Error('Authentication is not configured.');

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must sign in to update your profile photo.');

  const bytes = Uint8Array.from(atob(image.base64), (character) => character.charCodeAt(0));
  const avatarPath = `${userData.user.id}/avatar-${Date.now()}.${image.extension}`;
  const { error: uploadError } = await supabaseClient.storage
    .from('profile-photos')
    .upload(avatarPath, bytes, { contentType: image.contentType, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabaseClient
    .from('profiles')
    .update({ avatar_path: avatarPath })
    .eq('id', userData.user.id)
    .select('id, display_name, bio, avatar_path, preferred_locale, profile_type, setup_completed_at')
    .single();
  if (error || !data) throw error ?? new Error('Could not save your profile photo.');

  return data as AccountProfile;
}

export async function getAvatarUrl(avatarPath: string | null): Promise<string | null> {
  if (!supabaseClient || !avatarPath) return null;

  const { data, error } = await supabaseClient.storage.from('profile-photos').createSignedUrl(avatarPath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function completeAccountSetup(displayName: string, profileType: 'patient' | 'clinician') {
  if (!supabaseClient) throw new Error('Authentication is not configured.');

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must sign in to finish setting up your profile.');

  const { error } = await supabaseClient.rpc('complete_account_setup', {
    p_display_name: displayName.trim(),
    p_profile_type: profileType,
  });

  if (error) throw error;
}

export async function updatePreferredLocale(locale: 'ar' | 'fr' | 'en'): Promise<void> {
  if (!supabaseClient) throw new Error('Authentication is not configured.');

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must sign in to update your language preference.');

  const { error } = await supabaseClient
    .from('profiles')
    .update({ preferred_locale: locale })
    .eq('id', userData.user.id);

  if (error) throw error;
}

export async function getClinicianVerificationStatus(): Promise<'pending' | 'verified' | 'rejected' | 'suspended' | null> {
  if (!supabaseClient) throw new Error('Authentication is not configured.');

  const { data, error } = await supabaseClient
    .from('clinician_verifications')
    .select('verification_status')
    .maybeSingle();
  if (error) throw error;
  return (data?.verification_status as 'pending' | 'verified' | 'rejected' | 'suspended' | undefined) ?? null;
}
