import { useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

type AuthSnapshot = {
  session: Session | null;
  ready: boolean;
  error: string;
};

let snapshot: AuthSnapshot = { session: null, ready: false, error: '' };
let initialized = false;
const listeners = new Set<() => void>();

function publish(next: AuthSnapshot) {
  if (snapshot.session === next.session && snapshot.ready === next.ready && snapshot.error === next.error) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function initialize() {
  if (initialized || !supabase) return;
  initialized = true;

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    publish({ session, ready: true, error: '' });
  });

  void supabase.auth.getSession().then(({ data: sessionData, error }) => {
    publish({ session: sessionData.session, ready: true, error: error?.message ?? '' });
  }).catch((error: unknown) => {
    publish({ session: null, ready: true, error: error instanceof Error ? error.message : 'Could not restore admin session.' });
  });

  void data.subscription;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  initialize();
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function useAdminAuth() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
