import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Empty, Prose } from '../components/ui';
import type { Directory } from '../lib/alumni';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * Corrections other people have proposed.
 *
 * Grouped by man, because that is how they are judged -- someone who fixes a
 * phone number and guesses at an occupation in the same breath produces two
 * rows about one person, and seeing them together is what makes the guess
 * obvious.
 *
 * Each is still decided on its own. Approving calls apply_person_edit, which
 * re-checks the field is allowed before writing: the client naming a column is
 * not enough to change one.
 */

type Edit = {
  id: number;
  person_id: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  submitted_by: string | null;
};

const pretty = (field: string) =>
  field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function ProposedEditsScreen({
  directory,
  onChanged,
}: {
  directory: Directory | null;
  onChanged: () => void;
}) {
  const [edits, setEdits] = useState<Edit[] | null>(null);
  const [who, setWho] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('person_edits')
      .select('id, person_id, field, old_value, new_value, created_at, submitted_by')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }
    setEdits((data ?? []) as Edit[]);
    setError(null);

    // Who proposed them. A separate query because profiles are not joinable
    // from here without a foreign-key hint, and the list is short.
    const ids = [...new Set((data ?? []).map((e) => e.submitted_by).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids);
      setWho(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name ?? 'someone'])));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(edit: Edit, approve: boolean) {
    setBusy(edit.id);
    try {
      const { error } = await supabase.rpc('apply_person_edit', {
        p_edit_id: edit.id,
        p_approve: approve,
      });
      if (error) throw error;
      await load();
      onChanged();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  async function decideAll(group: Edit[], approve: boolean) {
    for (const e of group) await decide(e, approve);
  }

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.errTitle}>Could not load</Text>
        <Prose>{error}</Prose>
      </ScrollView>
    );
  }
  if (!edits) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }
  if (!edits.length) {
    return <Empty>Nobody has proposed any changes.</Empty>;
  }

  // Group by man, keeping the order the newest edit gave us.
  const byPerson: { personId: number; items: Edit[] }[] = [];
  for (const e of edits) {
    const found = byPerson.find((g) => g.personId === e.person_id);
    if (found) found.items.push(e);
    else byPerson.push({ personId: e.person_id, items: [e] });
  }

  const ago = (iso: string) => {
    const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  };

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.blurb}>
        Nothing here has changed his record. Approving is what writes it.
      </Text>

      {byPerson.map(({ personId, items }) => {
        const person = directory?.byId.get(personId);
        const proposer = who[items[0].submitted_by ?? ''] ?? 'Someone';
        return (
          <View key={personId} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.name}>{person?.name ?? `Person ${personId}`}</Text>
              <Text style={styles.meta}>
                {proposer} · {ago(items[0].created_at)}
              </Text>
            </View>

            {items.map((e) => (
              <View key={e.id} style={styles.change}>
                <Text style={styles.field}>{pretty(e.field)}</Text>
                <View style={styles.values}>
                  <Text style={styles.old} numberOfLines={2}>
                    {e.old_value || 'nothing'}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={14} color={colors.muted} />
                  <Text style={styles.new} numberOfLines={2}>
                    {e.new_value || 'cleared'}
                  </Text>
                </View>

                <View style={styles.rowActions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnYes]}
                    disabled={busy === e.id}
                    onPress={() => decide(e, true)}
                  >
                    {busy === e.id ? (
                      <ActivityIndicator size="small" color={colors.navy900} />
                    ) : (
                      <Text style={styles.btnYesText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btn}
                    disabled={busy === e.id}
                    onPress={() => decide(e, false)}
                  >
                    <Text style={styles.btnText}>Refuse</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {items.length > 1 ? (
              <View style={styles.allRow}>
                <TouchableOpacity onPress={() => decideAll(items, true)}>
                  <Text style={styles.allYes}>Accept all {items.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => decideAll(items, false)}>
                  <Text style={styles.allNo}>Refuse all</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: space.lg, gap: space.sm },
  errTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: colors.white },
  list: { padding: space.md, gap: space.sm + 4 },
  blurb: { ...type.body, fontSize: 13, color: colors.muted, opacity: 0.8 },
  card: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  name: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.white },
  meta: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted, opacity: 0.8 },
  change: {
    gap: 6,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(27,58,114,0.6)',
  },
  field: { ...type.label, fontSize: 9.5, color: colors.cyan },
  values: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  old: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  new: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: colors.white },
  rowActions: { flexDirection: 'row', gap: space.sm },
  btn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  btnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.muted },
  btnYes: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  btnYesText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.navy900 },
  allRow: { flexDirection: 'row', gap: space.md, paddingTop: 4 },
  allYes: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: colors.cyan },
  allNo: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.muted },
});
