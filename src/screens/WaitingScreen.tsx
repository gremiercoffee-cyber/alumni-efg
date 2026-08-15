import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * What someone sees between signing in and being let in.
 *
 * The important question is asked here rather than left to the admin to guess:
 * an email address does not say who a man is. rabbimiller@gmail.com might be
 * Rabbi Miller or his son, and everything downstream -- his alumni, his weekly
 * five, whose contact history is whose -- hangs off getting it right.
 *
 * He picks himself off the list; the admin confirms it when he approves. Until
 * then it is only a claim, held in its own column, and nothing reads it.
 */

type Choice = { id: number; name: string; title: string | null };

export default function WaitingScreen({
  email,
  claimedId,
  onClaimed,
}: {
  email: string | null;
  claimedId: number | null;
  onClaimed: () => void;
}) {
  const [staff, setStaff] = useState<Choice[] | null>(null);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      // Cast: staff_choices is created by migration 0028, so the generated
      // types do not know it yet.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => Promise<{ data: Choice[] | null; error: { message: string } | null }>;
        };
      }).from('staff_choices').select('*');
      if (error) setError(error.message);
      setStaff((data ?? []) as Choice[]);
    })();
  }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (staff ?? []).filter((s) => !term || s.name.toLowerCase().includes(term));
  }, [staff, q]);

  const claimed = staff?.find((s) => s.id === claimedId) ?? null;

  async function claim(id: number) {
    setSaving(id);
    setError(null);
    const { error } = await supabase.rpc('claim_staff' as never, { p_staff_id: id } as never);
    setSaving(null);
    if (error) {
      setError(error.message);
      return;
    }
    onClaimed();
  }

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.brand}>
          efg<Text style={styles.at}>@</Text>aish
        </Text>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signout}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>You're signed in. Now, who are you?</Text>
      <Text style={styles.body}>
        {email ? `${email} doesn't tell us which rebbe you are. ` : ''}
        Pick yourself from the list and the alumni director will let you in.
      </Text>

      {claimed ? (
        <View style={styles.claimed}>
          <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.cyan} />
          <View style={{ flex: 1 }}>
            <Text style={styles.claimedName}>{claimed.name}</Text>
            <Text style={styles.claimedNote}>
              Waiting for the alumni director. Tap another name if this is wrong.
            </Text>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.search}
        value={q}
        onChangeText={setQ}
        placeholder="Type your name…"
        placeholderTextColor={colors.muted}
        autoCapitalize="words"
        autoCorrect={false}
      />

      {!staff ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: space.lg }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(s) => String(s.id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.option, item.id === claimedId && styles.optionOn]}
              onPress={() => claim(item.id)}
              disabled={saving !== null}
            >
              <Text style={styles.optionText}>{item.name}</Text>
              {saving === item.id ? <ActivityIndicator size="small" color={colors.cyan} /> : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.body}>
              No name matches that. If you are not on the list, tell the alumni
              director and he will add you.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy900, padding: space.md, gap: space.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: colors.white },
  at: { color: colors.cyan },
  signout: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 21, color: colors.white, marginTop: space.sm },
  body: { ...type.body, color: colors.muted },
  claimed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(47,224,210,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(47,224,210,0.35)',
    borderRadius: radius.md,
    padding: space.md,
  },
  claimedName: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: colors.white },
  claimedNote: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted },
  error: { ...type.body, fontSize: 13, color: '#ff8a80' },
  search: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    marginTop: space.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleOnNavy,
  },
  optionOn: { backgroundColor: 'rgba(47,224,210,0.08)' },
  optionText: { fontFamily: 'Poppins_500Medium', fontSize: 15.5, color: colors.white },
});
