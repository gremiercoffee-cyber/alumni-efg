import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge, Empty, Prose } from '../components/ui';
import { announcementLink } from '../lib/contact';
import { SIMCHA_LABEL } from '../lib/simchas';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * Everything waiting on the admin, in one place.
 *
 * Three kinds of work, and they are genuinely different:
 *
 *   needs review     someone reported a simcha; nothing has happened yet
 *   no wedding date  a man got engaged and the date never arrived
 *   not announced    recorded, but the Mazal Tov has not gone out
 *
 * The last one replaces the email the old script sent you with a pre-filled
 * WhatsApp link. The difference is that this remembers whether you actually
 * sent it -- the email never did.
 */

type QueueRow = {
  kind: 'claim' | 'awaiting_date' | 'announce';
  id: number;
  subtype: string;
  since: string;
  person_id: number | null;
  staff_id: number | null;
  subject_name: string | null;
  report_count: number;
  status: string;
  on_date: string | null;
};

const GROUPS: [QueueRow['kind'], string, string][] = [
  ['claim', 'NEEDS YOUR REVIEW', 'Reported by someone else. Nothing has been sent.'],
  ['awaiting_date', 'ENGAGED, NO WEDDING DATE', 'The date never arrived, so no reminder can be scheduled.'],
  ['announce', 'NOT ANNOUNCED YET', 'Recorded, but the Mazal Tov has not gone out.'],
];

export default function AdminScreen({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('admin_queue')
      .select('*')
      .order('since', { ascending: false });
    if (error) setError(error.message);
    else {
      setRows((data ?? []) as QueueRow[]);
      setError(null);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(row: QueueRow, approve: boolean) {
    setBusyId(`${row.kind}-${row.id}`);
    try {
      const { data: me } = await supabase.auth.getUser();
      if (approve) {
        // Approving is what creates the real record -- and creating the simcha
        // is what fires the outbound notifications.
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
      setBusyId(null);
    }
  }

  async function announce(row: QueueRow) {
    const label = (SIMCHA_LABEL[row.subtype] ?? ' has a simcha').trim();
    const message = `Mazal tov to ${row.subject_name} who ${label.replace(/^'s /, "'s ")}!`;
    const url = announcementLink(message);
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open WhatsApp', message);
      return;
    }
    // Marked only after the share sheet actually opened, so the queue does not
    // quietly clear itself on a failure.
    const { data: me } = await supabase.auth.getUser();
    await supabase
      .from('simchas')
      .update({ announced_at: new Date().toISOString(), announced_by: me.user?.id ?? null })
      .eq('id', row.id);
    await load();
    onChanged();
  }

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.errTitle}>Could not load the queue</Text>
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
    return <Empty>Nothing waiting on you.</Empty>;
  }

  const since = (d: string) => {
    const days = Math.round((Date.now() - new Date(d).getTime()) / 86400000);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  };

  return (
    <ScrollView>
      {GROUPS.map(([kind, title, blurb]) => {
        const group = rows.filter((r) => r.kind === kind);
        if (!group.length) return null;
        return (
          <View key={kind}>
            <Text style={styles.group}>{title}</Text>
            <Text style={styles.blurb}>{blurb}</Text>
            {group.map((row) => {
              const busy = busyId === `${row.kind}-${row.id}`;
              return (
                <View key={`${row.kind}-${row.id}`} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.subject}>{row.subject_name}</Text>
                    <Text style={styles.when}>
                      {kind === 'awaiting_date' ? `${row.report_count} days` : since(row.since)}
                    </Text>
                  </View>
                  <Text style={styles.what}>
                    {(SIMCHA_LABEL[row.subtype] ?? row.subtype).trim().replace(/^'s /, 'his ')}
                  </Text>

                  {kind === 'claim' && row.report_count > 1 ? (
                    <View style={styles.pills}>
                      <Badge tone="cyan">{`${row.report_count} people reported this`}</Badge>
                    </View>
                  ) : null}

                  <View style={styles.actions}>
                    {kind === 'claim' ? (
                      <>
                        <TouchableOpacity
                          style={[styles.btn, styles.btnPrimary]}
                          disabled={busy}
                          onPress={() => review(row, true)}
                        >
                          {busy ? (
                            <ActivityIndicator color={colors.navy900} size="small" />
                          ) : (
                            <Text style={styles.btnPrimaryText}>Approve &amp; post</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.btn}
                          disabled={busy}
                          onPress={() => review(row, false)}
                        >
                          <Text style={styles.btnText}>Reject</Text>
                        </TouchableOpacity>
                      </>
                    ) : kind === 'announce' ? (
                      <TouchableOpacity
                        style={[styles.btn, styles.btnPrimary]}
                        onPress={() => announce(row)}
                      >
                        <Text style={styles.btnPrimaryText}>Send announcement</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.nudge}>
                        Ask him for the date, then report &ldquo;Wedding date set&rdquo;.
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
      <View style={{ height: space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: space.lg, gap: space.sm },
  errTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: colors.white },
  group: { ...type.label, color: colors.cyan, paddingHorizontal: space.md, paddingTop: space.lg },
  blurb: {
    ...type.body,
    fontSize: 13,
    color: colors.muted,
    opacity: 0.75,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  card: {
    marginHorizontal: space.md,
    marginBottom: space.sm + 4,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    backgroundColor: colors.navy800,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  subject: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.white },
  when: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted, opacity: 0.8 },
  what: { ...type.body, color: colors.muted },
  pills: { flexDirection: 'row', gap: 6, marginTop: 2 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, alignItems: 'center' },
  btn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  btnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: colors.muted },
  btnPrimary: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  btnPrimaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: colors.navy900 },
  nudge: { ...type.body, fontSize: 12.5, color: colors.muted, opacity: 0.8, flex: 1 },
});
