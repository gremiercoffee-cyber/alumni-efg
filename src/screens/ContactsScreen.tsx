import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import PersonRow from '../components/PersonRow';
import { Chip, ChipRow, Empty } from '../components/ui';
import {
  applyFilters,
  type AlumniRecord,
  type Directory,
  type Filters,
} from '../lib/alumni';
import { colors, radius, space, type } from '../theme';

export default function ContactsScreen({
  directory,
  filters,
  onFilters,
  onOpen,
  onContacted,
  mineOnly,
}: {
  directory: Directory | null;
  filters: Filters;
  onFilters: (f: Filters) => void;
  onOpen: (p: AlumniRecord) => void;
  onContacted: () => void;
  mineOnly: boolean;
}) {
  const rows = useMemo(
    () => (directory ? applyFilters(directory.people, { ...filters, mineOnly }) : []),
    [directory, filters, mineOnly],
  );

  const levels = filters.year ? directory?.levelsByYear.get(filters.year) ?? [] : [];

  const setYear = (y: string | null) =>
    // A level only means something inside a year, so dropping the year drops it.
    onFilters({ ...filters, year: y, level: y === null ? null : filters.level });

  return (
    <View style={styles.flex}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={filters.query}
          onChangeText={(q) => onFilters({ ...filters, query: q })}
          placeholder="Search name, city, college…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <ChipRow>
        <Chip label="All years" active={!filters.year} onPress={() => setYear(null)} />
        {(directory?.years ?? []).map((y) => (
          <Chip key={y} label={y} active={filters.year === y} onPress={() => setYear(y)} />
        ))}
      </ChipRow>

      {filters.year ? (
        <ChipRow label={`IN ${filters.year}`} sub>
          <Chip
            label="Any"
            active={!filters.level}
            onPress={() => onFilters({ ...filters, level: null })}
          />
          {levels.map((l) => (
            <Chip
              key={l}
              label={l}
              active={filters.level === l}
              onPress={() => onFilters({ ...filters, level: filters.level === l ? null : l })}
            />
          ))}
        </ChipRow>
      ) : null}

      <ChipRow label="REBBE" sub>
        <Chip
          label="Any"
          active={!filters.claim}
          onPress={() => onFilters({ ...filters, claim: null })}
        />
        <Chip
          label="Unclaimed"
          active={filters.claim === 'unclaimed'}
          onPress={() =>
            onFilters({ ...filters, claim: filters.claim === 'unclaimed' ? null : 'unclaimed' })
          }
        />
        <Chip
          label="Rebbe & close"
          active={filters.claim === 'mutual'}
          onPress={() =>
            onFilters({ ...filters, claim: filters.claim === 'mutual' ? null : 'mutual' })
          }
        />
      </ChipRow>

      <Text style={styles.count}>
        {rows.length} {mineOnly ? 'of yours' : `of ${directory?.people.length ?? 0}`}
      </Text>

      <FlatList
        data={rows}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => (
          <PersonRow person={item} onOpen={() => onOpen(item)} onContacted={onContacted} />
        )}
        ListEmptyComponent={
          <Empty>{directory ? 'Nobody matches that.' : 'Loading…'}</Empty>
        }
        initialNumToRender={14}
        windowSize={9}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchWrap: { paddingHorizontal: space.md, paddingBottom: space.sm + 4 },
  search: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  count: {
    ...type.label,
    fontSize: 10,
    color: colors.muted,
    opacity: 0.8,
    paddingHorizontal: space.md,
    paddingTop: 9,
    paddingBottom: 4,
  },
});
