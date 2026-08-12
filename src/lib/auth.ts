import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

/**
 * Google sign-in.
 *
 * The two platforms take different routes to the same place. On the web Supabase
 * redirects the whole page and the client picks the tokens out of the URL on the
 * way back (detectSessionInUrl is on for web only). On native we open a system
 * browser, wait for it to bounce back to our scheme, and set the session by hand
 * -- there is no page to redirect.
 *
 * Deliberately not @react-native-google-signin: it does not exist on web, so
 * using it would mean writing sign-in twice.
 */

// Closes the popup and hands control back on native.
WebBrowser.maybeCompleteAuthSession();

export function googleRedirectUri(): string {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  // Resolves to efgalumni://auth in a build, and to the Expo proxy in Expo Go.
  return AuthSession.makeRedirectUri({ scheme: 'efgalumni', path: 'auth' });
}

export async function signInWithGoogle(): Promise<{ error?: string }> {
  const redirectTo = googleRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // Native has no page to redirect, so ask for the URL and drive it ourselves.
      skipBrowserRedirect: Platform.OS !== 'web',
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) return { error: error.message };

  if (Platform.OS === 'web') {
    // The browser is already navigating away.
    return {};
  }

  if (!data?.url) return { error: 'Google did not return a sign-in URL.' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    return result.type === 'cancel' ? {} : { error: 'Sign-in was dismissed.' };
  }

  // Supabase returns the tokens in the fragment, which URL() does not parse for us.
  const fragment = result.url.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (!access_token || !refresh_token) {
    const query = new URLSearchParams(result.url.split('?')[1]?.split('#')[0] ?? '');
    const code = query.get('code');
    if (code) {
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      return exErr ? { error: exErr.message } : {};
    }
    return { error: 'Google did not return a session.' };
  }

  const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
  return setErr ? { error: setErr.message } : {};
}
