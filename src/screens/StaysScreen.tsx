import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Empty, Prose } from '../components/ui';
import { supabase } from '../lib/supabase';
import DateField from '../components/DatePicker';
import { colors, radius, space, type } from '../theme';

/**
 * Who is sleeping in the yeshiva, and whether there is a bed for them.
 *
 * Two views of one thing: a list of stays to edit, and a night-by-night
 * calendar. The calendar is the one that answers the question actually asked
 * out loud -- "how many beds do I need for Tuesday" -- which a list of stays
 * with start and end dates does not.
 *
 * has_bed is three-state. Null is "not looked at", false is "decided he does
 * not need one". Only null nags.
 */

type Stay = {
  id: number;
  person_id: number;
  visited_on: string;
  until_date: string | null;
  has_bed: boolean | null;
  bed_note: string | null;
  note: string | null;
};

type Night = {
  visit_id: number;
  person_id: number;
  name: string;
  night: string;
  has_bed: boolean | null;
  arrives: string;
  leaves: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const pretty = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

export default function StaysScreen({ onChanged }: { onChanged: () => void }) {
  const [nights, setNights] = useState<Night[] | null>(null);
  const [stays, setStays] = useState<Record<number, Stay>>({});
  const [names, setNames] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [view, setView] = useState<'list' | 'calendar'>('list');

  const load = useCallback(async () => {
    const from = iso(new Date(Date.now() - 30 * 86400000));
    const [n, v] = await Promise.all([
      supabase.from('stay_nights').select('*').gte('night', from).order('night'),
      supabase
        .from('visits')
        .select('id, person_id, visited_on, until_date, has_bed, bed_note, note')
        .eq('overnight', true)
        .eq('kind', 'yeshiva')
        .gte('visited_on', from)
        .order('visited_on'),
    ]);
    if (n.error || v.error) {
      setError((n.error ?? v.error)!.message);
      return;
    }
    setNights((n.data ?? []) as Night[]);
    setStays(Object.fromEntries(((v.data ?? []) as Stay[]).map((s) => [s.id, s])));
    setNames(
      Object.fromEntries(((n.data ?? []) as Night[]).map((x) => [x.person_id, x.name])),
    );
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setBed(id: number, value: boolean | null) {
    setBusy(id);
    try {
      const { error } = await supabase.from('visits').update({ has_bed: value }).eq('id', id);
      if (error) throw error;
      await load();
      onChanged();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  async function saveDates(id: number) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.from) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.to)) {
      Alert.alert('Dates', 'Both dates need to look like 2026-08-16.');
      return;
    }
    if (draft.to < draft.from) {
      Alert.alert('Dates', 'The last night cannot be before he arrives.');
      return;
    }
    setBusy(id);
    try {
      const { error } = await supabase
        .from('visits')
        .update({ visited_on: draft.from, until_date: draft.to })
        .eq('id', id);
      if (error) throw error;
      setEditing(null);
      await load();
      onChanged();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  function remove(id: number, name: string) {
    Alert.alert('Delete this stay?', `${name}'s stay will be removed entirely.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(id);
          try {
            const { error } = await supabase.from('visits').delete().eq('id', id);
            if (error) throw error;
            await load();
            onChanged();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Unknown error');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  /** Nights grouped into days, for the calendar. */
  const byNight = useMemo(() => {
    const m = new Map<string, Night[]>();
    for (const n of nights ?? []) {
      m.set(n.night, [...(m.get(n.night) ?? []), n]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [nights]);

  const staysList = useMemo(
    () => Object.values(stays).sort((a, b) => a.visited_on.localeCompare(b.visited_on)),
    [stays],
  );

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.errTitle}>Could not load</Text>
        <Prose>{error}</Prose>
      </ScrollView>
    );
  }
  if (!nights) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  const today = iso(new Date());

  return (
    <View style={styles.flex}>
      <View style={styles.toggle}>
        {(['list', 'calendar'] as const).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.toggleBtn, view === v && styles.toggleOn]}
            onPress={() => setView(v)}
          >
            <Text style={[styles.toggleText, view === v && styles.toggleTextOn]}>
              {v === 'list' ? 'Stays' : 'Night by night'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === 'list' ? (
        <ScrollView contentContainerStyle={styles.list}>
          {!staysList.length ? <Empty>Nobody is staying.</Empty> : null}

          {staysList.map((s) => {
            const name = names[s.person_id] ?? `Person ${s.person_id}`;
            const last = s.until_date ?? s.visited_on;
            const count =
              Math.round(
                (new Date(`${last}T00:00:00`).getTime() -
                  new Date(`${s.visited_on}T00:00:00`).getTime()) /
                  86400000,
              ) + 1;
            const over = last < today;

            return (
              <View key={s.id} style={[styles.card, over && styles.cardPast]}>
                <View style={styles.cardHead}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.when}>
                    {count} night{count === 1 ? '' : 's'}
                  </Text>
                </View>

                {editing === s.id ? (
                  <View style={styles.editRow}>
                    <DateField
                      value={draft.from || null}
                      onChange={(t) => setDraft((d) => ({ ...d, from: t }))}
                      placeholder="from"
                    />
                    <DateField
                      value={draft.to || null}
                      onChange={(t) => setDraft((d) => ({ ...d, to: t }))}
                      placeholder="until"
                    />
                    <TouchableOpacity onPress={() => saveDates(s.id)} disabled={busy === s.id}>
                      <Text style={styles.saveText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditing(null)}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.dates}>
                    {pretty(s.visited_on)} → {pretty(last)}
                  </Text>
                )}

                <View style={styles.bedRow}>
                  {([true, false, null] as const).map((v) => {
                    const on = s.has_bed === v;
                    const label = v === true ? 'Bed sorted' : v === false ? 'No bed needed' : 'Not yet';
                    return (
                      <TouchableOpacity
                        key={String(v)}
                        style={[styles.bed, on && (v === true ? styles.bedYes : v === false ? styles.bedNone : styles.bedOpen)]}
                        disabled={busy === s.id}
                        onPress={() => setBed(s.id, v)}
                      >
                        <Text style={[styles.bedText, on && styles.bedTextOn]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.rowActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditing(s.id);
                      setDraft({ from: s.visited_on, to: last });
                    }}
                  >
                    <Text style={styles.link}>Change dates</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(s.id, name)}>
                    <Text style={styles.danger}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {!byNight.length ? <Empty>No nights to show.</Empty> : null}

          {byNight.map(([night, men]) => {
            const short = men.filter((m) => m.has_bed !== true).length;
            return (
              <View key={night} style={[styles.night, night === today && styles.nightToday]}>
                <View style={styles.nightHead}>
                  <Text style={[styles.nightDate, night === today && styles.nightDateToday]}>
                    {pretty(night)}
                    {night === today ? ' · tonight' : ''}
                  </Text>
                  <Text style={short ? styles.short : styles.ok}>
                    {men.length} staying{short ? ` · ${short} without a bed` : ' · all sorted'}
                  </Text>
                </View>
                {men.map((m) => (
                  <View key={`${m.visit_id}-${m.night}`} style={styles.guest}>
                    <MaterialCommunityIcons
                      name={m.has_bed === true ? 'bed' : m.has_bed === false ? 'bed-empty' : 'help-circle-outline'}
                      size={15}
                      color={m.has_bed === true ? colors.cyan : m.has_bed === false ? colors.muted : colors.warn}
                    />
                    <Text style={styles.guestName}>{m.name}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: space.lg, gap: space.sm },
  errTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: colors.white },

  toggle: {
    flexDirection: 'row',
    gap: 6,
    padding: space.md,
    paddingBottom: space.sm,
  },
  toggleBtn: {
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  toggleOn: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  toggleText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: colors.muted },
  toggleTextOn: { fontFamily: 'Poppins_600SemiBold', color: colors.navy900 },

  list: { padding: space.md, paddingTop: 4, gap: space.sm + 4 },
  card: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
  },
  cardPast: { opacity: 0.55 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.white },
  when: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted },
  dates: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, color: colors.cyan },

  editRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dateInput: {
    flexGrow: 1,
    minWidth: 108,
    backgroundColor: colors.navy900,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
  },
  saveText: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: colors.cyan },
  cancelText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: colors.muted },

  bedRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  bed: {
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  bedYes: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  bedNone: { backgroundColor: colors.navy700, borderColor: colors.navy700 },
  bedOpen: { backgroundColor: colors.warn, borderColor: colors.warn },
  bedText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted },
  bedTextOn: { fontFamily: 'Poppins_600SemiBold', color: colors.navy900 },

  rowActions: { flexDirection: 'row', gap: space.md },
  link: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: colors.cyan },
  danger: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.bad },

  night: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    padding: space.md,
    gap: 6,
  },
  nightToday: { borderColor: colors.cyan },
  nightHead: { gap: 2 },
  nightDate: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: colors.white },
  nightDateToday: { color: colors.cyan },
  short: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.warn },
  ok: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.8 },
  guest: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  guestName: { ...type.body, fontSize: 13.5, color: colors.white },
});
