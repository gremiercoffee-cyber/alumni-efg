import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../lib/auth';
import { colors, radius, space, type } from '../theme';

/**
 * Sign-in by emailed six-digit code.
 *
 * Chosen over a magic link because the same flow works unchanged on the APK and
 * on the website -- a link has to be deep-linked back into the native app, which
 * is a second thing to configure and a second thing to break. Google sign-in
 * lands here later; it needs OAuth client ids and an Android rebuild.
 */
export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function google() {
    setBusy(true);
    setError(null);
    const { error } = await signInWithGoogle();
    setBusy(false);
    if (error) setError(error);
    // On success the auth listener in App swaps this screen out.
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    // On success the auth listener in App swaps this screen out; nothing to do here.
    if (error) setError(error.message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>EFG@Aish</Text>
        <Text style={styles.title}>Alumni</Text>
        <Text style={styles.blurb}>
          {sent
            ? `Enter the six-digit code sent to ${email.trim()}.`
            : 'Sign in with your email and we will send you a code.'}
        </Text>

        {!sent ? (
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@aish.edu"
            placeholderTextColor={colors.mutedDark}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={sendCode}
          />
        ) : (
          <TextInput
            style={[styles.input, styles.code]}
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={colors.mutedDark}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            onSubmitEditing={verify}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, busy && styles.buttonBusy]}
          onPress={sent ? verify : sendCode}
          disabled={busy || (sent ? code.length < 6 : !email.includes('@'))}
        >
          {busy ? (
            <ActivityIndicator color={colors.navy900} />
          ) : (
            <Text style={styles.buttonText}>{sent ? 'Sign in' : 'Send code'}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.rule} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.rule} />
        </View>

        <TouchableOpacity style={styles.google} onPress={google} disabled={busy}>
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        {sent ? (
          <TouchableOpacity
            onPress={() => {
              setSent(false);
              setCode('');
              setError(null);
            }}
          >
            <Text style={styles.link}>Use a different email</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy900,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  card: { width: '100%', maxWidth: 380, gap: space.md },
  eyebrow: { ...type.label, color: colors.cyan },
  title: { ...type.display, color: colors.white, fontSize: 40 },
  blurb: { ...type.body, color: colors.muted },
  input: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: colors.white,
    fontSize: 16,
  },
  code: { letterSpacing: 8, textAlign: 'center', fontSize: 24 },
  button: {
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: { ...type.title, color: colors.navy900, fontSize: 16 },
  link: { ...type.body, color: colors.cyan, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rule: { flex: 1, height: 1, backgroundColor: colors.ruleOnNavy },
  dividerText: { ...type.body, fontSize: 12, color: colors.muted, opacity: 0.7 },
  google: {
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    backgroundColor: colors.navy800,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  googleText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: colors.white },
  error: { ...type.body, color: colors.bad },
});
