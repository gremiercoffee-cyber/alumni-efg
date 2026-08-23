import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import PersonRow from '../components/PersonRow';
import { Chip, ChipRow, Empty } from '../components/ui';
import {
  applyFilters,
  type AlumniRecord,
  type Directory,
  type Filters,
} from '../lib/alumni';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

export default function ContactsScreen({
  directory,
  filters,
  onFilters,
  onOpen,
  onContacted,
  mineOnly,
  isAdmin,
  onCreated,
}: {
  directory: Directory | null;
  filters: Filters;
  onFilters: (f: Filters) => void;
  onOpen: (p: AlumniRecord) => void;
  onContacted: () => void;
  mineOnly: boolean;
  isAdmin: boolean;
  onCreated: (id: number) => void;
}) {
  const rows = useMemo(
    () => (directory ? applyFilters(directory.people, { ...filters, mineOnly }) : []),
    [directory, filters, mineOnly],
  );

  const [adding, setAdding] = useState(false);

  const levels = filters.year ? directory?.levelsByYear.get(filters.year) ?? [] : [];

  const setYear = (y: string | null) =>
    // A level only means something inside a year, so dropping the year drops it.
    onFilters({ ...filters, year: y, level: y === null ? null : filters.level });

  return (
    <View style={styles.flex}>
      <View style={styles.searchWrap}>
        {isAdmin ? (
          <TouchableOpacity
            style={styles.add}
            onPress={() => setAdding(true)}
            accessibilityLabel="Add someone new"
          >
            <Text style={styles.addText}>+ New</Text>
          </TouchableOpacity>
        ) : null}
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

      <ChipRow label="DOING" sub>
        <Chip
          label="In chinuch / kiruv"
          active={filters.chinuchOnly}
          onPress={() => onFilters({ ...filters, chinuchOnly: !filters.chinuchOnly })}
        />
      </ChipRow>

      <ChipRow label="REBBE" sub>
        <Chip
          label="Any rebbe"
          active={!filters.rebbe}
          onPress={() => onFilters({ ...filters, rebbe: null })}
        />
        <Chip
          label="No rebbe"
          active={filters.rebbe === 'unclaimed'}
          onPress={() =>
            onFilters({ ...filters, rebbe: filters.rebbe === 'unclaimed' ? null : 'unclaimed' })
          }
        />
        {(directory?.rebbeimWithPeople ?? []).map((name) => (
          <Chip
            key={name}
            label={name}
            active={filters.rebbe === name}
            onPress={() =>
              onFilters({ ...filters, rebbe: filters.rebbe === name ? null : name })
            }
          />
        ))}
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
      <NewPerson
        visible={adding}
        onClose={() => setAdding(false)}
        onCreated={(id) => {
          setAdding(false);
          onCreated(id);
        }}
      />
    </View>
  );
}

/**
 * Add a man who is not on the sheet.
 *
 * Only a name is asked for. Everything else is on his record behind the pencil,
 * and a form that demands a college and a phone number before it will let you
 * write down that someone exists is a form people work around.
 */
function NewPerson({
  visible, onClose, onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = first.trim().length > 0 && last.trim().length > 0;

  async function create() {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('people')
        .insert({ first_name: first.trim(), last_name: last.trim() })
        .select('id')
        .single();
      if (error) throw error;
      setFirst(''); setLast('');
      onCreated(data.id as number);
    } catch (e) {
      Alert.alert('Could not add him', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Add someone</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.modalInput}
            value={first}
            onChangeText={setFirst}
            placeholder="First name"
            placeholderTextColor={colors.muted}
            autoFocus
          />
          <TextInput
            style={styles.modalInput}
            value={last}
            onChangeText={setLast}
            placeholder="Last name"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.modalHint}>
            His record opens next, where the rest goes in.
          </Text>
          <TouchableOpacity
            style={[styles.modalBtn, !ready && styles.modalBtnOff]}
            disabled={!ready || busy}
            onPress={create}
          >
            {busy ? (
              <ActivityIndicator color={colors.navy900} />
            ) : (
              <Text style={styles.modalBtnText}>Add him</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  add: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cyan,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  addText: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: colors.cyan },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.navy900,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: space.md,
    paddingBottom: space.lg,
    gap: space.sm,
  },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.white },
  modalClose: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: colors.muted },
  modalInput: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
  },
  modalHint: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.75 },
  modalBtn: {
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalBtnOff: { opacity: 0.35 },
  modalBtnText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: colors.navy900 },
  flex: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm + 4,
  },
  search: {
    flex: 1,
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
