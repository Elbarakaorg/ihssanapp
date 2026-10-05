import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import { listDoseLogs, listMyTreatments, logAsNeededDose, logDose } from '@/features/medicine/repository';
import { toLocalDateKey, type DoseLog, type Treatment } from '@/features/medicine/schedule';

/** Loads the signed-in patient's treatments plus the last 7 days of dose logs, and logs doses optimistically. */
export function useTreatments() {
  const { session } = useAuth();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [loading, setLoading] = useState(!!session);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!session) { setTreatments([]); setLogs([]); setLoading(false); return; }
    const mine = ++seq.current;
    setError('');
    try {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const [t, l] = await Promise.all([listMyTreatments(), listDoseLogs(toLocalDateKey(from), toLocalDateKey(new Date()))]);
      if (mine !== seq.current) return;
      setTreatments(t);
      setLogs(l);
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : 'Could not load treatments.');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const setDose = useCallback(async (medicationId: string, dateKey: string, slot: string, status: 'taken' | 'skipped' | null) => {
    const previous = logs;
    setLogs((cur) => {
      const rest = cur.filter((l) => !(l.medication_id === medicationId && l.scheduled_for === dateKey && l.slot === slot));
      return status ? [...rest, { medication_id: medicationId, scheduled_for: dateKey, slot, status }] : rest;
    });
    try { await logDose(medicationId, dateKey, slot, status); }
    catch (e) { setLogs(previous); setError(e instanceof Error ? e.message : 'Could not save this dose.'); }
  }, [logs]);

  /** As-needed intake: the server enforces the daily maximum and minimum gap, so reload afterwards to show the saved amount. */
  const takeAsNeeded = useCallback(async (medicationId: string, dateKey: string, slot: string, status: 'taken' | null) => {
    setError('');
    try { await logAsNeededDose(medicationId, dateKey, slot, status); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save this dose.'); }
  }, [reload]);

  return { treatments, logs, loading, error, reload, setDose, takeAsNeeded };
}
