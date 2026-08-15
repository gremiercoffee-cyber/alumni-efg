import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Badge, Empty, Prose } from '../components/ui';
import type { Directory } from '../lib/alumni';
import { announcementFor } from '../lib/announce';
import { announcementLink, reachByPhone } from '../lib/contact';
import { labelFor } from '../lib/simchas';
import { supabase } from '../lib/supabase';
import DateField from '../components/DatePicker';
import { colors, radius, space, type } from '../theme';

/**
 * Everything waiting on the admin, in one place.
 *
 *   needs a bed      staying in the yeshiva with nowhere to sleep
 *   no wedding date  a man got engaged and the date never arrived
 *   not announced    it has happened, and the Mazal Tov has not gone out
 *
 * Only what is owed. A wedding three months away is news, not work, and it
 * reads correctly on the feed -- putting it here made the queue mostly things
 * there was nothing to do about, which is how a queue stops being read.
 *
 * The last one replaces the email the old script sent, with a pre-filled
 * WhatsApp link. It goes to the alumni group, not to the man: announcing that
 * he is married is not a message to him, so his own number never comes into
 * it.
 */

type QueueRow = {
  kind: 'awaiting_date' | 'needs_bed' | 'announce';
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
  ['needs_bed', 'NEEDS A BED', 'Staying in the yeshiva with nowhere to sleep yet.'],
  ['awaiting_date', 'SET A WEDDING DATE', 'Engaged, but nobody has recorded when the wedding is.'],
  ['announce', 'SEND THE MAZAL TOV', 'Over and done with. The announcement has not gone out.'],
];

/** Days from today to a date, negative for the past. */
function daysTo(iso: string | null): number {
  if (!iso) return -1;
  const then = new Date(`${iso}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((then - today.getTime()) / 86400000);
}

function whenText(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 0) return `in ${days} days`;
  if (days === -1) return 'yesterday';
  return `${-days} days ago`;
}

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
  // Per-row, so typing a date into one card does not disturb another.
  const [dateDraft, setDateDraft] = useState<Record<number, string>>({});

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

  /**
   * Record the date he just told you.
   *
   * `parent_simcha_id` is the whole point: the engagement leaves this queue on a
   * wedding row linked back to it, not on one that merely exists for the same
   * man. The row's id is the engagement, which is exactly what is needed.
   */
  async function saveWeddingDate(row: QueueRow) {
    const date = dateDraft[row.id]?.trim() ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Pick a date first', 'Tap the date field and choose the day.');
      return;
    }
    setBusyId(`${row.kind}-${row.id}`);
    try {
      const { error } = await supabase.from('simchas').insert({
        person_id: row.person_id,
        staff_id: row.staff_id,
        // A dated wedding is a wedding, dated ahead. 'wedding_scheduled' is
        // excluded from the feed, so filing one made the man disappear.
        type: 'wedding',
        occurred_on: date,
        wedding_on: date,
        parent_simcha_id: row.id,
      });
      if (error) throw error;
      setDateDraft((d) => {
        const next = { ...d };
        delete next[row.id];
        return next;
      });
      await load();
      onChanged();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  async function sortBed(row: QueueRow) {
    setBusyId(`${row.kind}-${row.id}`);
    try {
      // The queue row's id is the visit, not the person.
      const { error } = await supabase.from('visits').update({ has_bed: true }).eq('id', row.id);
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
        const group = rows.filter((r) => {
          if (r.kind !== kind) return false;
          // The Mazal Tov waits until the day after. On the day itself he is
          // at his own wedding and the message would land in the middle of it;
          // the morning after is when people want to hear, and when he might
          // actually read it. The queue offers it from the day of, so the last
          // day is held back here.
          if (kind === 'announce' && daysTo(r.on_date) >= 0) return false;
          return true;
        });
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
                      {kind === 'needs_bed'
                        ? `arrives ${whenText(daysTo(row.on_date))}`
                        : kind === 'awaiting_date'
                        ? `engaged ${row.report_count} days ago`
                        : row.on_date
                          ? whenText(daysTo(row.on_date))
                          : since(row.since)}
                    </Text>
                  </View>
                  {/* Tense follows the date. This said "got married" about a
                      wedding still months away. */}
                  <Text style={styles.what}>
                    {kind === 'needs_bed'
                      ? `staying ${row.report_count} night${row.report_count === 1 ? '' : 's'}`
                      : labelFor(row.subtype, daysTo(row.on_date)).trim().replace(/^'s /, 'his ')}
                    {row.on_date
                      ? ` · ${new Date(`${row.on_date}T00:00:00`).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}`
                      : ''}
                  </Text>

                  {false ? (
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
                    {kind === 'needs_bed' ? (
                      <TouchableOpacity
                        style={[styles.btn, styles.btnPrimary]}
                        disabled={busy}
                        onPress={() => sortBed(row)}
                      >
                        {busy ? (
                          <ActivityIndicator color={colors.navy900} size="small" />
                        ) : (
                          <Text style={styles.btnPrimaryText}>Bed sorted</Text>
                        )}
                      </TouchableOpacity>
                    ) : kind === 'announce' ? (
                      <TouchableOpacity
                        style={[styles.btn, styles.btnPrimary]}
                        onPress={() => announce(row)}
                      >
                        <Text style={styles.btnPrimaryText}>Send announcement</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        {/* Asking is half of it. This is the other half -- until
                            now there was nowhere to put the answer. */}
                        <View style={styles.dateInput}>
                          <DateField
                            value={dateDraft[row.id] ?? null}
                            onChange={(v) => setDateDraft((d) => ({ ...d, [row.id]: v }))}
                            placeholder="Pick the date"
                          />
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.btn,
                            styles.btnPrimary,
                            !/^\d{4}-\d{2}-\d{2}$/.test(dateDraft[row.id] ?? '') && styles.btnOff,
                          ]}
                          disabled={busy || !/^\d{4}-\d{2}-\d{2}$/.test(dateDraft[row.id] ?? '')}
                          onPress={() => saveWeddingDate(row)}
                        >
                          {busy ? (
                            <ActivityIndicator color={colors.navy900} size="small" />
                          ) : (
                            <Text style={styles.btnPrimaryText}>Save</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.btn, styles.btnWa, (dnc || !person?.phone) && styles.btnOff]}
                          disabled={dnc || !person?.phone}
                          onPress={() => person && reachByPhone(person, onChanged)}
                        >
                          <FontAwesome name="whatsapp" size={16} color={colors.whatsapp} />
                          <Text style={styles.btnText}>
                            {dnc ? 'Do not contact' : person?.phone ? 'Ask him' : 'No number'}
                          </Text>
                        </TouchableOpacity>
                      </>
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
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dateInput: { minWidth: 150 },
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
