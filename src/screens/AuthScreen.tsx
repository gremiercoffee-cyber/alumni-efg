import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { COLORS, FONTS } from '../constants';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      const redirectTo = AuthSession.makeRedirectUri({ scheme: 'com.gremier.notekeeper' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Google sign-in could not start.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return;

      const params = new URL(result.url).searchParams;
      const code = params.get('code');
      if (code) {
        const sessionResult = await supabase.auth.exchangeCodeForSession(code);
        if (sessionResult.error) throw sessionResult.error;
        return;
      }

      const hashParams = new URLSearchParams(result.url.split('#')[1] || '');
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      if (access_token && refresh_token) {
        const sessionResult = await supabase.auth.setSession({ access_token, refresh_token });
        if (sessionResult.error) throw sessionResult.error;
      }
    } catch (error: any) {
      Alert.alert('Sign-in failed', error.message || 'Could not sign in with Google.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Text style={styles.kicker}>NOTEKEEPER</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to sync your notes, lists, calendar, and keeper items.</Text>
      </View>
      <TouchableOpacity style={[styles.button, busy && styles.buttonDisabled]} onPress={signIn} disabled={busy} activeOpacity={0.86}>
        <Text style={styles.buttonText}>{busy ? 'Opening Google...' : 'Continue with Google'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
  },
  kicker: {
    color: COLORS.brownLight,
    fontSize: FONTS.size.xs,
    letterSpacing: 2,
    marginBottom: 10,
  },
  title: {
    color: COLORS.brown,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.brownLight,
    fontSize: FONTS.size.base,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.brown,
    borderRadius: 30,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    minWidth: 240,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#fff7f1',
    fontSize: FONTS.size.base,
    fontWeight: '700',
  },
});
