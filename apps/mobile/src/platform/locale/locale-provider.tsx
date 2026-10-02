import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import { getCurrentUserProfile, updatePreferredLocale } from '@/features/profile/profile-repository';

export type AppLocale = 'ar' | 'fr' | 'en';

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
};

const STORAGE_KEY = 'ihssan.locale';
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [locale, setLocaleState] = useState<AppLocale>('en');

  useEffect(() => {
    let active = true;
    if (session) {
      void getCurrentUserProfile().then((profile) => {
        if (active) setLocaleState(profile.preferred_locale);
      }).catch(() => undefined);
    } else {
      void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
        if (active && (stored === 'en' || stored === 'fr' || stored === 'ar')) setLocaleState(stored);
      });
    }
    return () => { active = false; };
  }, [session]);

  const setLocale = (nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    if (session) void updatePreferredLocale(nextLocale).catch(() => undefined);
    else void AsyncStorage.setItem(STORAGE_KEY, nextLocale);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within LocaleProvider.');
  return context;
}
