import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { GoogleSignin, GoogleSigninButton, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { COLORS, FONTS } from '../constants';
import { supabase } from '../lib/supabase';

const GOOGLE_WEB_CLIENT_ID = '828739249323-ibtlal9p01vodk47ne68dfcf5ck84b18.apps.googleusercontent.com';

export default function AuthScreen() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });
  }, []);

  const signInWithGoogle = async () => {
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      if (!isSuccessResponse(userInfo)) return;

      const idToken = userInfo.data?.idToken;

      if (!idToken) throw new Error('No ID token returned');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;
    } catch (error: any) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Sign in failed', error.message || 'Could not sign in with Google.');
      }
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
      <GoogleSigninButton
        style={[styles.googleButton, busy && styles.buttonDisabled]}
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Light}
        onPress={signInWithGoogle}
        disabled={busy}
      />
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
  googleButton: {
    width: 240,
    height: 56,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
