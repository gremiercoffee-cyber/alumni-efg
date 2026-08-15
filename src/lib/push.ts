import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/**
 * Registering this device to be notified.
 *
 * Deliberately quiet about failure. A man who says no to notifications, or an
 * emulator with no push service, must not be shown an error -- he did not ask
 * for this, it happened on launch, and a warning about something he did not
 * request reads as the app being broken.
 *
 * Nothing is sent from here. The token is an address; sending happens on the
 * server, on a schedule, and is switched off until it is deliberately enabled.
 */

// How a notification behaves when it lands while the app is open. Shown, not
// swallowed: these are things you would want to see mid-conversation.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPush(): Promise<string | null> {
  // The web needs a service worker and VAPID keys, which is its own piece of
  // work; the site is not installed, so there is nothing to notify.
  if (Platform.OS === 'web') return null;

  try {
    // Android will not show anything without a channel, and silently drops the
    // notification rather than complaining.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Alumni news',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
      // Hardcoded fallback: Constants can come back empty in an updated bundle
      // whose manifest was written by an older build, and without a project id
      // Expo cannot mint a token at all.
      ?? '6bb5fbcc-8752-4266-8155-d09efae25dc1';
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    const { data: me } = await supabase.auth.getUser();
    if (!me.user) return null;

    // Upsert on the token: the same device re-registering every launch must
    // update its row rather than add another, or one phone ends up notified
    // five times.
    await supabase
      .from('push_tokens')
      .upsert(
        { profile_id: me.user.id, token, platform: Platform.OS },
        { onConflict: 'token' },
      );

    return token;
  } catch {
    return null;
  }
}
