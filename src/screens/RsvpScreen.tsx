import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * The page a man lands on when he taps the link. No account, no sign-in.
 *
 * It shows him the event and takes his answer, and that is all it can do -- the
 * two functions behind it return the event and record the RSVP, and nothing
 * else is reachable with the token. Who else is coming is not a link-holder's
 * business.
 *
 * The email is the only field that matters: it is how the answer gets matched
 * to the man on file. An address nobody recognises is still recorded, against
 * nobody, so the count stays right and the admin attaches him afterwards.
 */

type Ev = {
  event_name: string;
  starts_on: string | null;
  ends_on: string | null;
  location: string | null;
  description: string | null;
};

const pretty = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

export default function RsvpScreen({ token }: { token: string }) {
  const [ev, setEv] = useState<Ev | null | 'missing'>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [guests, setGuests] = useState('0');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'recorded' | 'recorded_unmatched' | 'closed' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc('rsvp_event', { p_token: token });
      if (error || !data || !(data as Ev[]).length) setEv('missing');
      else setEv((data as Ev[])[0]);
    })();
  }, [token]);

  const ready = email.includes('@') && email.trim().length > 4;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('submit_rsvp', {
        p_token: token,
        p_email: email.trim(),
        p_name: name.trim() || null,
        p_guests: Math.max(0, Number(guests) || 0),
      });
      if (error) throw error;
      setDone(data as typeof done);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send it. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (ev === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  if (ev === 'missing') {
    return (
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.brand}>efg<Text style={styles.at}>@</Text>aish</Text>
          <Text style={styles.title}>This link is not open</Text>
          <Text style={styles.body}>
            Either it has been closed or the address is not quite right. Ask whoever
            sent it for a fresh one.
          </Text>
        </View>
      </View>
    );
  }

  if (done) {
    return (
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.brand}>efg<Text style={styles.at}>@</Text>aish</Text>
          <Text style={styles.title}>
            {done === 'closed' ? 'RSVPs have closed' : 'You are down as coming'}
          </Text>
          <Text style={styles.body}>
            {done === 'closed'
              ? 'The list for this one is shut. Get in touch directly if you still want to come.'
              : `See you at ${ev.event_name}.`}
          </Text>
          {done === 'recorded_unmatched' ? (
            <Text style={styles.note}>
              That address is not the one we have on file, so someone will match it up
              by hand. You are counted either way.
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text style={styles.brand}>efg<Text style={styles.at}>@</Text>aish</Text>
        <Text style={styles.title}>{ev.event_name}</Text>

        {ev.starts_on ? (
          <Text style={styles.when}>
            {pretty(ev.starts_on)}
            {ev.ends_on && ev.ends_on !== ev.starts_on ? ` — ${pretty(ev.ends_on)}` : ''}
          </Text>
        ) : null}
        {ev.location ? <Text style={styles.body}>{ev.location}</Text> : null}
        {ev.description ? <Text style={styles.desc}>{ev.description}</Text> : null}

        <View style={styles.rule} />

        <Text style={styles.label}>YOUR NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>YOUR EMAIL</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>ANYONE COMING WITH YOU?</Text>
        <TextInput
          style={styles.input}
          value={guests}
          onChangeText={setGuests}
          placeholder="0"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
        />
        <Text style={styles.hint}>Not counting yourself.</Text>

        <TouchableOpacity
          style={[styles.submit, !ready && styles.submitOff]}
          disabled={!ready || busy}
          onPress={submit}
        >
          {busy ? (
            <ActivityIndicator color={colors.navy900} />
          ) : (
            <Text style={styles.submitText}>I'm coming</Text>
          )}
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.navy900,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  page: {
    flexGrow: 1,
    backgroundColor: colors.navy900,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
    paddingVertical: space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.lg ?? 16,
    padding: space.lg,
    gap: 7,
  },
  brand: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: colors.white, marginBottom: 4 },
  at: { color: colors.cyan },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 22, color: colors.white },
  when: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: colors.cyan },
  body: { ...type.body, color: colors.muted },
  desc: { ...type.body, color: colors.muted, marginTop: 4 },
  note: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.muted, opacity: 0.8 },
  rule: { height: 1, backgroundColor: colors.ruleOnNavy, marginVertical: space.md },
  label: { ...type.label, color: colors.cyan, marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: colors.navy900,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
  },
  hint: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.7 },
  submit: {
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.md,
  },
  submitOff: { opacity: 0.35 },
  submitText: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: colors.navy900 },
  error: { ...type.body, fontSize: 13, color: '#ff8a80', marginTop: 8 },
});
