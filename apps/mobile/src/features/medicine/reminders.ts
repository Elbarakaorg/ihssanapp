import { Platform } from 'react-native';

import { isMedicationDue, isTreatmentRunning, toLocalDateKey, formatAmount, type Treatment } from './schedule';

export type PlannedReminder = { at: Date; title: string; body: string };

const MAX_SCHEDULED = 60; // iOS keeps at most 64 pending local notifications.

/** Upcoming dose reminders for the next `horizonDays` days, soonest first. Pure so it can be tested. */
export function planReminders(treatments: Treatment[], now = new Date(), horizonDays = 7): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (let offset = 0; offset < horizonDays; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const key = toLocalDateKey(day);
    for (const treatment of treatments) {
      if (!isTreatmentRunning(treatment, key)) continue;
      for (const m of treatment.medications) {
        if (!isMedicationDue(treatment, m, key)) continue;
        for (const slot of m.times) {
          const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(slot.slice(0, 2)), Number(slot.slice(3, 5)));
          if (at <= now) continue;
          planned.push({ at, title: `Time for ${m.name}`, body: [formatAmount(m.amount, m.unit), m.instructions].filter(Boolean).join(' · ') });
        }
      }
    }
  }
  return planned.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED);
}

const PREF_KEY = 'ihssan.reminders';

async function loadNotifications() {
  if (Platform.OS === 'web') return null;
  return import('expo-notifications');
}

async function store() {
  const SecureStore = await import('expo-secure-store');
  return SecureStore;
}

export async function remindersEnabled() {
  if (Platform.OS === 'web') return false;
  try { return (await (await store()).getItemAsync(PREF_KEY)) === 'on'; } catch { return false; }
}

export const remindersSupported = Platform.OS !== 'web';

/** Asks for permission (when turning on), then replaces every pending reminder with the current plan. Returns false when permission is refused. */
export async function setReminders(enabled: boolean, treatments: Treatment[]): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) { await (await store()).setItemAsync(PREF_KEY, 'off'); return true; }

  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) { await (await store()).setItemAsync(PREF_KEY, 'off'); return false; }
  await (await store()).setItemAsync(PREF_KEY, 'on');
  await scheduleAll(Notifications, treatments);
  return true;
}

/** Re-plans reminders after treatments change. No-op unless the user turned reminders on. */
export async function syncReminders(treatments: Treatment[]) {
  const Notifications = await loadNotifications();
  if (!Notifications || !(await remindersEnabled())) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await scheduleAll(Notifications, treatments);
}

async function scheduleAll(Notifications: typeof import('expo-notifications'), treatments: Treatment[]) {
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  for (const r of planReminders(treatments)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body || 'Open Ihssan to log your dose.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
    });
  }
}
