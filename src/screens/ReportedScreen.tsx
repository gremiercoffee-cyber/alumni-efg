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
import { Badge, Empty, Prose } from '../components/ui';
import type { Directory } from '../lib/alumni';
import { SIMCHA_LABEL } from '../lib/simchas';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * What other people have reported, waiting on a decision.
 *
 * Moved out of To Do deliberately: this is reading someone else's judgement,
 * which is a different job from "send the Mazal Tov", and stacking them made
 * the queue read as two unrelated lists.
 *
 * Approving is what creates the real record -- and creating that record is what
 * sends anything outward. Nothing here has reached anybody.
 */

type Claim = {
  id: number;
  subtype: string;
  since: string;
  person_id: number | null;
  staff_id: number | null;
  subject_name: string | null;
  report_count: number;
  on_date: string | null;
};

export default function ReportedScreen({
  directory,
  onChanged,
}: {
  directory: Directory | null;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Claim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('reported_claims')
      .select('*')
      .order('since', { ascending: false });
    if (error) setError(error.message);
    else {
      setRows((data ?? []) as Claim[]);
      setError(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(row: Claim, approve: boolean) {
    setBusy(row.id);
    try {
      const { data: me } = await supabase.auth.getUser();
      if (approve) {
        const { error: insErr } = await supabase.from('simchas').insert({
          person_id: row.person_id,
          staff_id: row.staff_id,
          type: row.subtype as never,
          occurred_on: row.on_date ?? new Date().toISOString().slice(0, 10),
          created_by: me.user?.id ?? null,
        });
        if (insErr) throw insErr;
      }
      const { error } = await supabase
        .from('claims')
        .update({
          status: approve ? 'approved' : 'rejected',
          reviewed_by: me.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (error) throw error;
      await load();
      onChanged();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.errTitle}>Could not load</Text>
        <Prose>{error}</Prose>
      </ScrollView>
    );
  }
  if (!rows) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }
  if (!rows.length) {
    return <Empty>Nobody has reported anything.</Empty>;
  }

  const ago = (d: string) => {
    const days = Math.round((Date.now() - new Date(d).getTime()) / 86400000);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  };

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.blurb}>
        Nothing here has been recorded or sent. Approving is what does both.
      </Text>

      {rows.map((row) => {
        const person = row.person_id ? directory?.byId.get(row.person_id) : null;
        return (
          <View key={row.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.name}>{row.subject_name}</Text>
              <Text style={styles.meta}>{ago(row.since)}</Text>
            </View>
            <Text style={styles.what}>
              {(SIMCHA_LABEL[row.subtype] ?? row.subtype).trim().replace(/^'s /, 'his ')}
              {row.on_date ? ` · ${row.on_date}` : ''}
            </Text>

            {/* Corroboration. Seven rebbeim saying the same thing is worth
                knowing before deciding, and is why reports are kept even though
                only the first one notifies. */}
            {row.report_count > 1 ? (
              <View style={styles.pills}>
                <Badge tone="cyan">{`${row.report_count} people reported this`}</Badge>
              </View>
            ) : null}

            {person?.years.length ? (
              <Text style={styles.years}>{person.years.join(' · ')}</Text>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnYes]}
                disabled={busy === row.id}
                onPress={() => decide(row, true)}
              >
                {busy === row.id ? (
                  <ActivityIndicator size="small" color={colors.navy900} />
                ) : (
                  <Text style={styles.btnYesText}>Approve &amp; post</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btn}
                disabled={busy === row.id}
                onPress={() => decide(row, false)}
              >
                <Text style={styles.btnText}>Reject</Text>
              </TouchableOpacity>
            </View>
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
    gap: 6,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.white },
  meta: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted, opacity: 0.8 },
  what: { ...type.body, color: colors.muted },
  years: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted, opacity: 0.7 },
  pills: { flexDirection: 'row', gap: 6 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
  btn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  btnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: colors.muted },
  btnYes: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  btnYesText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: colors.navy900 },
});
