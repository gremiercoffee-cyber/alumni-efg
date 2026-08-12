import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Directory } from '../lib/alumni';
import { SIMCHA_ICON, SIMCHA_LABEL, type FeedItem } from '../lib/simchas';
import { colors, space, type } from '../theme';
import { ChipRow, Chip, Empty } from '../components/ui';

/**
 * The simcha feed, two years back.
 *
 * Upcoming first with a countdown, then everything behind grouped by month --
 * two years of undifferentiated cards is unreadable without the headers.
 */
export default function HomeScreen({
  feed,
  directory,
  mineOnly,
  year,
  onMineOnly,
  onYear,
}: {
  feed: FeedItem[];
  directory: Directory | null;
  mineOnly: boolean;
  year: string | null;
  onMineOnly: (v: boolean) => void;
  onYear: (v: string | null) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const shown = useMemo(() => {
    return feed.filter((f) => {
      if (!directory) return true;
      const p = f.person_id ? directory.byId.get(f.person_id) : null;
      // A rebbe's own simcha has no program year and belongs to nobody, so both
      // filters drop it. That is intended -- you asked for your alumni.
      if (mineOnly && !(p as { mine?: boolean } | null)?.mine) return false;
      if (year && !p?.years.includes(year)) return false;
      return true;
    });
  }, [feed, directory, mineOnly, year]);

  const days = (d: string | null) =>
    d ? Math.round((new Date(`${d}T00:00:00`).getTime() - today.getTime()) / 86400000) : 0;

  const upcoming = shown.filter((f) => days(f.on_date) >= 0)
    .sort((a, b) => (a.on_date ?? '').localeCompare(b.on_date ?? ''));
  const past = shown.filter((f) => days(f.on_date) < 0)
    .sort((a, b) => (b.on_date ?? '').localeCompare(a.on_date ?? ''));

  // Enrollments came out: it counts rows, not people, so it says nothing anyone
  // wants to know. Its slot is for current students, once that data exists.
  const stats = directory
    ? [
        [directory.people.length, 'Alumni'],
        [directory.people.filter((p) => p.years.length > 1).length, 'Stayed 2+ yrs'],
      ]
    : [];

  const monthOf = (d: string | null) =>
    d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '';

  const card = (f: FeedItem) => {
    const isEvent = f.kind === 'event';
    const title = isEvent
      ? f.subject_name
      : `${f.subject_name ?? ''}${SIMCHA_LABEL[f.subtype] ?? ''}`;
    const d = days(f.on_date);
    const when =
      d === 0 ? 'today' : d > 0 ? `in ${d}d`
        : new Date(`${f.on_date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return (
      <View key={`${f.kind}-${f.id}`} style={styles.card}>
        <View style={[styles.icon, isEvent && styles.iconEvent]}>
          <Text style={styles.iconText}>{SIMCHA_ICON[f.subtype] ?? '\u{1F4C5}'}</Text>
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>{title}</Text>
          {f.detail ? <Text style={styles.cardSub}>{f.detail}</Text> : null}
        </View>
        <Text style={[styles.when, d >= 0 && styles.whenSoon]}>{when}</Text>
      </View>
    );
  };

  let lastMonth = '';
  return (
    <View style={styles.flex}>
      <View style={styles.stats}>
        {stats.map(([n, label]) => (
          <View key={label as string} style={styles.stat}>
            <Text style={styles.statNum}>{Number(n).toLocaleString()}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <ChipRow>
        <Chip label="Everyone" active={!mineOnly} onPress={() => onMineOnly(false)} />
        <Chip label="My alumni" active={mineOnly} onPress={() => onMineOnly(true)} />
      </ChipRow>
      <ChipRow label="YEAR" sub>
        <Chip label="Any" active={!year} onPress={() => onYear(null)} />
        {(directory?.years ?? []).map((y) => (
          <Chip key={y} label={y} active={year === y} onPress={() => onYear(y)} />
        ))}
      </ChipRow>

      <ScrollView>
        {!shown.length ? (
          <Empty>
            {feed.length
              ? 'No simchas match that filter.'
              : 'Nothing here yet. Report a simcha and it will show up.'}
          </Empty>
        ) : null}

        {upcoming.length ? <Text style={styles.group}>COMING UP</Text> : null}
        {upcoming.map(card)}

        {past.map((f) => {
          const m = monthOf(f.on_date);
          const header = m !== lastMonth ? m : null;
          lastMonth = m;
          return (
            <React.Fragment key={`${f.kind}-${f.id}`}>
              {header ? <Text style={styles.group}>{header.toUpperCase()}</Text> : null}
              {card(f)}
            </React.Fragment>
          );
        })}

        {past.length ? (
          <Text style={styles.end}>That&apos;s two years. Anything older isn&apos;t shown.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleOnNavy,
  },
  stat: { flex: 1 },
  statNum: { fontFamily: 'Poppins_700Bold', fontSize: 21, color: colors.cyan },
  statLabel: { ...type.label, fontSize: 9, color: colors.muted, opacity: 0.8 },
  group: {
    ...type.label,
    color: colors.cyan,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 4,
    paddingHorizontal: space.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(27,58,114,0.55)',
  },
  icon: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: colors.navy700, alignItems: 'center', justifyContent: 'center',
  },
  iconEvent: { backgroundColor: 'rgba(28,79,176,0.4)' },
  iconText: { fontSize: 16 },
  cardMain: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: colors.white },
  cardSub: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.muted, opacity: 0.8 },
  when: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted },
  whenSoon: { fontFamily: 'Poppins_600SemiBold', color: colors.cyan },
  end: {
    textAlign: 'center', padding: space.lg,
    fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.6,
  },
});
