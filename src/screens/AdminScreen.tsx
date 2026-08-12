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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Badge, Empty, Prose } from '../components/ui';
import type { Directory } from '../lib/alumni';
import { announcementFor } from '../lib/announce';
import { announcementLink, reachByPhone } from '../lib/contact';
import { SIMCHA_LABEL } from '../lib/simchas';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * Everything waiting on the admin, in one place.
 *
 *   needs review     someone reported a simcha; nothing has happened yet
 *   no wedding date  a man got engaged and the date never arrived
 *   not announced    recorded, but the Mazal Tov has not gone out
 *
 * The last one replaces the email the old script sent, with a pre-filled
 * WhatsApp link. The difference is that this remembers whether it was sent --
 * and, now, lets you take that back.
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
  ['awaiting_date', 'ENGAGED, NO WEDDING DATE', 'Ask him when it is, then report the date.'],
  ['announce', 'NOT ANNOUNCED YET', 'Recorded, but the Mazal Tov has not gone out.'],
];

export default function AdminScreen({
  directory,
  onChanged,
}: {
  directory: Directory | null;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [justAnnounced, setJustAnnounced] = useState<Set<number>>(new Set());

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

  useEffect(() => {
    void load();
  }, [load]);

  const personFor = (row: QueueRow) =>
    row.person_id ? (directory?.byId.get(row.person_id) ?? null) : null;

  async function review(row: QueueRow, approve: boolean) {
    setBusyId(`${row.kind}-${row.id}`);
    try {
      const { data: me } = await supabase.auth.getUser();
      if (approve) {
        // Approving is what creates the real record, and creating the simcha is
        // what fires the outbound notifications.
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

  function announce(row: QueueRow) {
    const message = announcementFor(
      row.subject_name ?? '',
      row.subtype,
      personFor(row),
      row.staff_id != null,
    );
    // Confirm first: marking it announced is easy to do by accident, and until
    // now there was no way back.
    Alert.alert('Send this?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open WhatsApp', onPress: () => void doAnnounce(row, message) },
    ]);
  }

  async function doAnnounce(row: QueueRow, message: string) {
    try {
      await Linking.openURL(announcementLink(message));
    } catch {
      Alert.alert('Could not open WhatsApp', message);
      return;
    }
    // Only after the share sheet actually opened, so a failure does not quietly
    // clear the queue.
    const { data: me } = await supabase.auth.getUser();
    await supabase
      .from('simchas')
      .update({ announced_at: new Date().toISOString(), announced_by: me.user?.id ?? null })
      .eq('id', row.id);
    setJustAnnounced((s) => new Set(s).add(row.id));
    await load();
    onChanged();
  }

  async function undoAnnounce(id: number) {
    await supabase.from('simchas').update({ announced_at: null, announced_by: null }).eq('id', id);
    setJustAnnounced((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
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

  const since = (d: string) => {
    const days = Math.round((Date.now() - new Date(d).getTime()) / 86400000);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  };

  const undoable = [...justAnnounced];

  return (
    <ScrollView>
      {undoable.length ? (
        <View style={styles.undoBar}>
          <Text style={styles.undoText}>
            {undoable.length === 1 ? 'Announcement sent.' : `${undoable.length} announcements sent.`}
          </Text>
          <TouchableOpacity onPress={() => undoable.forEach((id) => void undoAnnounce(id))}>
            <Text style={styles.undoAction}>Undo</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!rows.length ? <Empty>Nothing waiting on you.</Empty> : null}

      {GROUPS.map(([kind, title, blurb]) => {
        const group = rows.filter((r) => r.kind === kind);
        if (!group.length) return null;
        return (
          <View key={kind}>
            <Text style={styles.group}>{title}</Text>
            <Text style={styles.blurb}>{blurb}</Text>
            {group.map((row) => {
              const busy = busyId === `${row.kind}-${row.id}`;
              const person = personFor(row);
              const dnc = person?.do_not_contact ?? false;

              return (
                <View key={`${row.kind}-${row.id}`} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.subject}>{row.subject_name}</Text>
                    <Text style={styles.when}>
                      {kind === 'awaiting_date'
                        ? `engaged ${row.report_count} days ago`
                        : since(row.since)}
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

                  {/* Who else can be asked about the date. His programme rebbe and
                      anyone who has said they are close with him. */}
                  {kind === 'awaiting_date' && person ? (
                    <View style={styles.rebbeim}>
                      <Text style={styles.rebbeimLabel}>ASK ALSO</Text>
                      {person.claimedBy.length || person.programRebbeim.length ? (
                        <View style={styles.pills}>
                          {[
                            ...new Set([
                              ...person.programRebbeim.map((r) => r.rebbe),
                              ...person.claimedBy,
                            ]),
                          ].map((name) => (
                            <Badge key={name} tone={person.mutual.includes(name) ? 'cyan' : 'plain'}>
                              {name}
                            </Badge>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.nudge}>No rebbe is attached to him.</Text>
                      )}
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
                      <TouchableOpacity
                        style={[styles.btn, styles.btnWa, (dnc || !person?.phone) && styles.btnOff]}
                        disabled={dnc || !person?.phone}
                        onPress={() => person && reachByPhone(person, onChanged)}
                      >
                        <FontAwesome name="whatsapp" size={16} color={colors.whatsapp} />
                        <Text style={styles.btnText}>
                          {dnc ? 'Do not contact' : person?.phone ? 'Ask him the date' : 'No number'}
                        </Text>
                      </TouchableOpacity>
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
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  rebbeim: { marginTop: 4, gap: 5 },
  rebbeimLabel: { ...type.label, fontSize: 9, color: colors.muted, opacity: 0.7 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, alignItems: 'center' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  btnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: colors.muted },
  btnPrimary: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  btnPrimaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: colors.navy900 },
  btnWa: { backgroundColor: 'rgba(37,211,102,0.14)' },
  btnOff: { opacity: 0.4 },
  nudge: { ...type.body, fontSize: 12.5, color: colors.muted, opacity: 0.8 },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(47,224,210,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(47,224,210,0.35)',
  },
  undoText: { ...type.body, color: colors.white },
  undoAction: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: colors.cyan },
});
