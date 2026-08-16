import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

/**
 * Reminders the phone sets for itself.
 *
 * Expo's push service needs Firebase credentials on Android, which this project
 * has none of -- so getExpoPushTokenAsync cannot mint a token and no server can
 * reach the device at all. That is a real gap for anything sudden.
 *
 * It is not a gap for this. A wedding is recorded days or months ahead, so the
 * phone already knows when to speak, and a scheduled local notification needs no
 * Firebase, no token and no server. The alarm is set on the device, by the
 * device, and fires whether or not it has signal.
 *
 * The limit is honest: it can only remind about things known when the app was
 * last open. Recording a wedding schedules its reminder there and then, and
 * every launch re-syncs, so in practice the only miss is a wedding recorded by
 * somebody else on a phone that is never opened between then and the day.
 */

const NINE_AM = 9;

type Upcoming = {
  id: number;
  occurred_on: string;
  people: { first_name: string; last_name: string } | null;
};

/** 9am, local time, the morning after. */
function morningAfter(dateIso: string): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  // Built from parts rather than parsed: a Date from "2026-09-06" is UTC
  // midnight, which in Israel is already the 6th but in New York is the 5th.
  const when = new Date(y, m - 1, d, NINE_AM, 0, 0, 0);
  when.setDate(when.getDate() + 1);
  return when;
}

/**
 * Re-set every wedding reminder this phone should hold.
 *
 * Cancel-then-schedule rather than reconciling: the set is small, and working
 * out which of yesterday's alarms still apply is more code and more ways to end
 * up with two notifications for one wedding.
 */
export async function syncWeddingReminders(isAdmin: boolean): Promise<number> {
  if (Platform.OS === 'web' || !isAdmin) return 0;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('simchas')
      .select('id, occurred_on, people(first_name, last_name)')
      .in('type', ['wedding', 'child_wedding'])
      .is('announced_at', null)
      .gte('occurred_on', today)
      .order('occurred_on');
    if (error) throw error;

    await Notifications.cancelAllScheduledNotificationsAsync();

    let set = 0;
    for (const row of (data ?? []) as unknown as Upcoming[]) {
      if (!row.occurred_on) continue;
      const when = morningAfter(row.occurred_on);
      if (when.getTime() <= Date.now()) continue;

      const name = row.people
        ? `${row.people.first_name} ${row.people.last_name}`
        : 'An alumnus';

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Send the Mazal Tov',
          body: `${name} got married yesterday. It's in your To Do list.`,
          data: { simchaId: row.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
        },
      });
      set += 1;
    }
    return set;
  } catch {
    // Silent by design. This runs on launch, nobody asked for it, and a phone
    // that refuses notifications must not be shown an error for it.
    return 0;
  }
}

/** What is currently set, for the drawer to report. */
export async function scheduledCount(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    return 0;
  }
}
