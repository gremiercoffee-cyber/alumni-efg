import React, { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Directory } from '../lib/alumni';
import { SIMCHA_LABEL, visualFor, type FeedItem } from '../lib/simchas';
import { colors, radius, space, type } from '../theme';
import { Chip, ChipRow, Empty } from '../components/ui';

/**
 * The simcha feed, two years back, laid out as a diary.
 *
 * The date is the anchor rather than an afterthought: what you scan a feed of
 * dated events for is *when*.
 *
 * Sections are relative near the present and calendar months further out,
 * because those are the useful units at either end. Nobody thinks of next
 * Tuesday as "August 2026", and nobody thinks of last spring as "203 days ago".
 */

type Section = { title: string; data: FeedItem[] };

const MS_DAY = 86400000;

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Which bucket a date falls in, and how the buckets order against each other. */
function bucketOf(when: Date, today: Date): { key: string; title: string; rank: number } {
  const days = Math.round((startOfDay(when).getTime() - today.getTime()) / MS_DAY);
  const sameMonth =
    when.getFullYear() === today.getFullYear() && when.getMonth() === today.getMonth();
  const monthLabel = when.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (days === 0) return { key: 'today', title: 'Today', rank: 0 };
  if (days > 0) {
    if (days <= 7) return { key: 'week', title: 'This week', rank: 1 };
    if (sameMonth) return { key: 'month', title: 'Later this month', rank: 2 };
    // Fractional rank keeps September ahead of October without a second sort.
    return { key: `f-${monthLabel}`, title: monthLabel, rank: 3 + days / 100000 };
  }
  if (days >= -7) return { key: 'p-week', title: 'Earlier this week', rank: 1000 };
  if (sameMonth) return { key: 'p-month', title: 'Earlier this month', rank: 1001 };
  return { key: `p-${monthLabel}`, title: monthLabel, rank: 1002 - days / 100000 };
}

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
  const today = startOfDay(new Date());

  const sections = useMemo<Section[]>(() => {
    const shown = feed.filter((f) => {
      if (!f.on_date) return false;
      if (!directory) return true;
      const p = f.person_id ? directory.byId.get(f.person_id) : null;
      // A rebbe's own simcha has no programme year and belongs to nobody, so
      // both filters drop it. Intended -- you asked for *your* alumni.
      if (mineOnly && !(p as { mine?: boolean } | null)?.mine) return false;
      if (year && !p?.years.includes(year)) return false;
      return true;
    });

    const buckets = new Map<string, { title: string; rank: number; data: FeedItem[] }>();
    for (const item of shown) {
      const b = bucketOf(new Date(`${item.on_date}T00:00:00`), today);
      const existing = buckets.get(b.key);
      if (existing) existing.data.push(item);
      else buckets.set(b.key, { title: b.title, rank: b.rank, data: [item] });
    }

    return [...buckets.values()]
      .sort((a, b) => a.rank - b.rank)
      .map((b) => ({
        title: b.title,
        // Upcoming reads soonest first; past reads most recent first.
        data: b.data.sort((x, y) =>
          b.rank < 1000
            ? (x.on_date ?? '').localeCompare(y.on_date ?? '')
            : (y.on_date ?? '').localeCompare(x.on_date ?? ''),
        ),
      }));
  }, [feed, directory, mineOnly, year, today]);

  // Enrollments came out: it counted rows, not people, so it said nothing
  // anyone wants to know. Its slot is for current students.
  const stats: [number, string][] = directory
    ? [
        [directory.people.length, 'Alumni'],
        [directory.people.filter((p) => p.years.length > 1).length, 'Stayed 2+ yrs'],
      ]
    : [];

  return (
    <View style={styles.flex}>
      <View style={styles.stats}>
        {stats.map(([n, label]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.statNum}>{n.toLocaleString()}</Text>
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

      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHead}>{section.title.toUpperCase()}</Text>
        )}
        renderItem={({ item }) => <Row item={item} today={today} />}
        ListEmptyComponent={
          <Empty>
            {feed.length
              ? 'No simchas match that filter.'
              : 'Nothing here yet. Report a simcha and it will show up.'}
          </Empty>
        }
        ListFooterComponent={
          sections.length ? (
            <Text style={styles.end}>
              That&apos;s two years. Anything older isn&apos;t shown.
            </Text>
          ) : null
        }
        initialNumToRender={12}
        windowSize={9}
      />
    </View>
  );
}

function Row({ item, today }: { item: FeedItem; today: Date }) {
  const when = new Date(`${item.on_date}T00:00:00`);
  const days = Math.round((startOfDay(when).getTime() - today.getTime()) / MS_DAY);
  const { icon, tint } = visualFor(item.subtype);

  const title =
    item.kind === 'event'
      ? item.subject_name
      : `${item.subject_name ?? ''}${SIMCHA_LABEL[item.subtype] ?? ''}`;

  const relative =
    days === 0
      ? 'today'
      : days === 1
        ? 'tomorrow'
        : days > 0
          ? `in ${days} days`
          : days === -1
            ? 'yesterday'
            : `${-days} days ago`;

  return (
    <View style={styles.row}>
      <View style={[styles.dateBox, days === 0 && styles.dateBoxToday]}>
        <Text style={[styles.dateDay, days === 0 && styles.dateTodayText]}>{when.getDate()}</Text>
        <Text style={[styles.dateMonth, days === 0 && styles.dateTodayMonth]}>
          {when.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
        </Text>
      </View>

      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.rowSub}>{[item.detail, relative].filter(Boolean).join(' · ')}</Text>
      </View>

      <View style={[styles.icon, { backgroundColor: `${tint}22` }]}>
        <MaterialCommunityIcons name={icon as never} size={18} color={tint} />
      </View>
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
  statNum: { fontFamily: 'Poppins_700Bold', fontSize: 22, color: colors.cyan },
  statLabel: { ...type.label, fontSize: 9, color: colors.muted, opacity: 0.8 },

  sectionHead: {
    ...type.label,
    color: colors.cyan,
    backgroundColor: colors.navy900,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleOnNavy,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 6,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(27,58,114,0.45)',
  },
  dateBox: {
    width: 48,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    alignItems: 'center',
  },
  dateBoxToday: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  dateDay: { fontFamily: 'Poppins_700Bold', fontSize: 19, color: colors.white, lineHeight: 22 },
  dateMonth: { ...type.label, fontSize: 9, color: colors.muted, opacity: 0.85 },
  dateTodayText: { color: colors.navy900 },
  dateTodayMonth: { color: colors.navy900, opacity: 0.7 },

  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: colors.white },
  rowSub: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.8 },

  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  end: {
    textAlign: 'center',
    padding: space.lg,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: colors.muted,
    opacity: 0.6,
  },
});
