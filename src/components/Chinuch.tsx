import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { AlumniRecord } from '../lib/alumni';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * Whether a man is in chinuch or kiruv, shown beside his name.
 *
 * Two jobs in one control: a glance ("is he?") and a detail ("doing what?").
 * The badge answers the first from across a list; tapping it opens the second,
 * because the role is the part a rebbe actually wants and a bare checkmark
 * throws it away.
 *
 * Any approved user sets it, no review -- it is something a rebbe knows about
 * his own guys, and a wrong flag misinforms nobody outside the app.
 */

/** Just the badge, for a dense list row. Nothing at all if he is not flagged. */
export function ChinuchBadge({ person }: { person: AlumniRecord }) {
  if (!(person as { in_chinuch?: boolean }).in_chinuch) return null;
  return (
    <MaterialCommunityIcons
      name="book-open-variant"
      size={15}
      color={colors.chinuch}
      accessibilityLabel="In chinuch or kiruv"
    />
  );
}

/** The badge plus its editor, for a record screen. */
export function ChinuchControl({
  person,
  onChanged,
}: {
  person: AlumniRecord;
  onChanged: () => void;
}) {
  const p = person as AlumniRecord & { in_chinuch?: boolean; chinuch_role?: string | null };
  const [open, setOpen] = useState(false);
  const [inChinuch, setInChinuch] = useState(!!p.in_chinuch);
  const [role, setRole] = useState(p.chinuch_role ?? '');
  const [busy, setBusy] = useState(false);

  async function save(next: boolean, text: string) {
    setBusy(true);
    const { error } = await supabase.rpc('set_chinuch', {
      p_person_id: person.id,
      p_in: next,
      p_role: text,
    });
    setBusy(false);
    if (error) return;
    setInChinuch(next);
    setRole(next ? text.trim() : '');
    setOpen(false);
    onChanged();
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.chip, inChinuch && styles.chipOn]}
        onPress={() => setOpen(true)}
      >
        <MaterialCommunityIcons
          name="book-open-variant"
          size={15}
          color={inChinuch ? colors.navy900 : colors.chinuch}
        />
        <Text style={[styles.chipText, inChinuch && styles.chipTextOn]} numberOfLines={1}>
          {inChinuch ? p.chinuch_role || 'In chinuch' : 'Mark chinuch / kiruv'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.wrap}>
          <View style={styles.sheet}>
            <View style={styles.head}>
              <Text style={styles.title}>Chinuch / kiruv</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.close}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>WHAT HE DOES</Text>
            <TextInput
              style={styles.input}
              value={role}
              onChangeText={setRole}
              placeholder="Rebbe at HALB · campus kiruv, Maryland"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <Text style={styles.hint}>
              A few words. This shows beside his name, so a rebbe scanning the list
              knows at a glance.
            </Text>

            <TouchableOpacity
              style={[styles.save, role.trim().length < 2 && styles.saveOff]}
              disabled={role.trim().length < 2 || busy}
              onPress={() => save(true, role)}
            >
              {busy ? (
                <ActivityIndicator color={colors.navy900} size="small" />
              ) : (
                <Text style={styles.saveText}>{inChinuch ? 'Update' : 'He is in chinuch'}</Text>
              )}
            </TouchableOpacity>

            {inChinuch ? (
              <TouchableOpacity style={styles.clear} disabled={busy} onPress={() => save(false, '')}>
                <Text style={styles.clearText}>He is not — remove the flag</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.chinuch,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: space.sm,
  },
  chipOn: { backgroundColor: colors.chinuch, borderColor: colors.chinuch },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.chinuch, flexShrink: 1 },
  chipTextOn: { color: colors.navy900 },

  wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.navy900,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: space.md,
    paddingBottom: space.lg,
    gap: 6,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.white },
  close: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: colors.muted },
  label: { ...type.label, color: colors.cyan, marginTop: space.sm, marginBottom: 6 },
  input: {
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
  hint: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.75 },
  save: {
    backgroundColor: colors.chinuch,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: space.md,
  },
  saveOff: { opacity: 0.35 },
  saveText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: colors.navy900 },
  clear: { paddingVertical: 12, alignItems: 'center' },
  clearText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: colors.muted },
});
