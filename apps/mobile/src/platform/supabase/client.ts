import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const browserStorage = {
  async getItem(key: string) {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseClient = supabaseUrl && publishableKey
  ? createClient(supabaseUrl, publishableKey, {
      auth: {
        storage: Platform.OS === 'web' ? browserStorage : secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;