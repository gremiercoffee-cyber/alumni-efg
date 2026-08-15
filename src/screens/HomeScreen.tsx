import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { AlumniRecord, Directory } from '../lib/alumni';
import { reachByEmail, reachByPhone } from '../lib/contact';
import { labelFor, visualFor, type FeedItem } from '../lib/simchas';
import { MineStar } from '../lib/mine';
import { colors, radius, space, type } from '../theme';
import { Chip, ChipRow, Empty } from '../components/ui';

/**
 * The simcha feed, two years back, laid out as a diary.
 *
 * One ascending timeline: oldest at the top, newest at the bottom, opening at
 * today. Scroll up for the past, down for what is coming.
 *
 * Built on a flat list with fixed row heights rather than a SectionList,
 * because opening at today has to be exact. SectionList.scrollToLocation
 * measures lazily and lands wherever it happens to have laid out -- which is
 * why this opened on the 1st of June. getItemLayout removes the guesswork.
 */

const MS_DAY = 86400000;
const ROW_H = 74;
const HEADER_H = 42;

type Entry =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'row'; key: string; item: FeedItem; person: AlumniRecord | null };

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/**
 * Titles are relative near the present and calendar months further out: nobody
 * thinks of next Tuesday as "August 2026", or of last spring as "203 days ago".
 */
function bucketOf(when: Date, today: Date): { key: string; title: string } {
  const days = Math.round((startOfDay(when).getTime() - today.getTime()) / MS_DAY);
  const sameMonth =
    when.getFullYear() === today.getFullYear() && when.getMonth() === today.getMonth();
  const monthLabel = when.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (days === 0) return { key: 'today', title: 'Today' };
  if (days > 0) {
    if (days <= 7) return { key: 'week', title: 'This week' };
    if (sameMonth) return { key: 'month', title: 'Later this month' };
    return { key: `f-${monthLabel}`, title: monthLabel };
  }
  if (days >= -7) return { key: 'p-week', title: 'Earlier this week' };
  if (sameMonth) return { key: 'p-month', title: 'Earlier this month' };
  return { key: `p-${monthLabel}`, title: monthLabel };
}

export default function HomeScreen({
  feed,
  directory,
  mineOnly,
  year,
  onMineOnly,
  onYear,
  onContacted,
  onOpen,
}: {
  feed: FeedItem[];
  directory: Directory | null;
  mineOnly: boolean;
  year: string | null;
  onMineOnly: (v: boolean) => void;
  onYear: (v: string | null) => void;
  onContacted: () => void;
  onOpen: (item: FeedItem) => void;
}) {
  const today = startOfDay(new Date());
  const todayIso = today.toISOString().slice(0, 10);

  const { entries, startIndex } = useMemo(() => {
    const shown = feed
      .filter((f) => {
        if (!f.on_date) return false;
        if (!directory) return true;
        const p = f.person_id ? directory.byId.get(f.person_id) : null;
        // A rebbe's own simcha has no programme year and belongs to nobody, so
        // both filters drop it. Intended -- you asked for *your* alumni.
        if (mineOnly && !(p as { mine?: boolean } | null)?.mine) return false;
        if (year && !p?.years.includes(year)) return false;
        return true;
      })
      .sort((a, b) => (a.on_date ?? '').localeCompare(b.on_date ?? ''));

    const out: Entry[] = [];
    let lastBucket = '';
    let firstFuture = -1;

    for (const item of shown) {
      const b = bucketOf(new Date(`${item.on_date}T00:00:00`), today);
      if (b.key !== lastBucket) {
        out.push({ kind: 'header', key: `h-${b.key}`, title: b.title });
        lastBucket = b.key;
        // Open on the *header* of today's group, so its label is on screen too.
        if (firstFuture === -1 && (item.on_date ?? '') >= todayIso) {
          firstFuture = out.length - 1;
        }
      }
      out.push({
        kind: 'row',
        key: `${item.kind}-${item.id}`,
        item,
        person: item.person_id ? (directory?.byId.get(item.person_id) ?? null) : null,
      });
    }

    return {
      entries: out,
      // Nothing upcoming: sit at the end, which is the most recent past.
      startIndex: firstFuture === -1 ? Math.max(out.length - 1, 0) : firstFuture,
    };
  }, [feed, directory, mineOnly, year, today, todayIso]);

  // Enrollments came out of the strip: it counted rows, not people.
  // Its slot is for current students.
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

      <FlatList
        // Remounting on a filter change re-applies initialScrollIndex; without
        // it the list keeps whatever offset the previous filter left behind.
        key={`${mineOnly}-${year ?? 'all'}`}
        data={entries}
        keyExtractor={(e) => e.key}
        initialScrollIndex={startIndex}
        getItemLayout={(data, index) => {
          let offset = 0;
          for (let i = 0; i < index; i++) {
            offset += data![i].kind === 'header' ? HEADER_H : ROW_H;
          }
          return {
            length: data![index]?.kind === 'header' ? HEADER_H : ROW_H,
            offset,
            index,
          };
        }}
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <Text style={styles.sectionHead}>{item.title.toUpperCase()}</Text>
          ) : (
            <Row item={item.item} person={item.person} today={today} onContacted={onContacted}
          onOpen={onOpen}
        />
          )
        }
        ListEmptyComponent={
          <Empty>
            {feed.length
              ? 'No simchas match that filter.'
              : 'Nothing here yet. Report a simcha and it will show up.'}
          </Empty>
        }
        ListHeaderComponent={entries.length ? <Text style={styles.edge}>Two years back.</Text> : null}
        ListFooterComponent={
          entries.length ? <Text style={styles.edge}>Nothing further ahead.</Text> : null
        }
        initialNumToRender={14}
        windowSize={11}
      />
    </View>
  );
}

function Row({
  item,
  person,
  today,
  onContacted,
  onOpen,
}: {
  item: FeedItem;
  person: AlumniRecord | null;
  today: Date;
  onContacted: () => void;
  onOpen: (item: FeedItem) => void;
}) {
  const when = new Date(`${item.on_date}T00:00:00`);
  const days = Math.round((startOfDay(when).getTime() - today.getTime()) / MS_DAY);
  const { icon, tint } = visualFor(item.subtype);

  // Tense follows the date: a wedding next week has not happened yet.
  const title =
    item.kind === 'event'
      ? item.subject_name
      : `${item.subject_name ?? ''}${labelFor(item.subtype, days)}`;

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

  const dnc = person?.do_not_contact ?? false;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => onOpen(item)}
      accessibilityLabel={`Open ${item.subject_name ?? 'this'}`}
    >
      <View style={[styles.dateBox, days === 0 && styles.dateBoxToday]}>
        <Text style={[styles.dateDay, days === 0 && styles.dateTodayText]}>{when.getDate()}</Text>
        <Text style={[styles.dateMonth, days === 0 && styles.dateTodayMonth]}>
          {when.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
        </Text>
      </View>

      <View style={styles.rowMain}>
        <View style={styles.titleLine}>
          <MaterialCommunityIcons name={icon as never} size={14} color={tint} />
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {[item.detail, relative].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {/* Reach the man whose simcha it is without leaving the feed. Events and
          rebbeim's own simchas have nobody to reach, so they get no buttons. */}
      {person ? (
        <View style={styles.actions}>
          <MineStar personId={person.id} size={18} />
          <TouchableOpacity
            style={[styles.act, styles.actWa, (dnc || !person.phone) && styles.actOff]}
            disabled={dnc || !person.phone}
            onPress={() => reachByPhone(person, onContacted)}
            accessibilityLabel={`Message ${person.name}`}
          >
            <FontAwesome name="whatsapp" size={17} color={colors.whatsapp} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.act, (dnc || !person.email) && styles.actOff]}
            disabled={dnc || !person.email}
            onPress={() => reachByEmail(person, onContacted)}
            accessibilityLabel={`Email ${person.name}`}
          >
            <MaterialIcons name="mail-outline" size={16} color={colors.cyan} />
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
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
    height: HEADER_H,
    lineHeight: HEADER_H - 14,
    color: colors.cyan,
    backgroundColor: colors.navy900,
    paddingHorizontal: space.md,
    paddingTop: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleOnNavy,
  },

  row: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 4,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(27,58,114,0.45)',
  },
  dateBox: {
    width: 46,
    paddingVertical: 5,
    borderRadius: radius.md,
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    alignItems: 'center',
  },
  dateBoxToday: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  dateDay: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: colors.white, lineHeight: 21 },
  dateMonth: { ...type.label, fontSize: 8.5, color: colors.muted, opacity: 0.85 },
  dateTodayText: { color: colors.navy900 },
  dateTodayMonth: { color: colors.navy900, opacity: 0.7 },

  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: colors.white },
  rowSub: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted, opacity: 0.8 },

  actions: { flexDirection: 'row', gap: 5 },
  act: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    backgroundColor: colors.navy800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actWa: { backgroundColor: 'rgba(37,211,102,0.14)' },
  actOff: { opacity: 0.25 },

  edge: {
    textAlign: 'center',
    padding: space.lg,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: colors.muted,
    opacity: 0.6,
  },
});
