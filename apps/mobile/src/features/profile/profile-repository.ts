import { supabaseClient } from '@/platform/supabase/client';

export type AccountProfile = {
  id: string;
  display_name: string;
  preferred_locale: 'ar' | 'fr' | 'en';
  profile_type: 'patient' | 'caregiver' | 'clinician';
};

export async function getCurrentUserProfile(): Promise<AccountProfile> {
  if (!supabaseClient) throw new Error('Authentication is not configured.');

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must sign in to access your profile.');

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, display_name, preferred_locale, profile_type')
    .eq('id', userData.user.id)
    .single();

  if (error) throw error;
  return data as AccountProfile;
}
