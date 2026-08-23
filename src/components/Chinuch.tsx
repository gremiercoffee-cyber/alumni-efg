import React, { createContext, useContext, useEffect, useState } from 'react';
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
import type { Directory } from '../lib/alumni';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * Whether a man is in chinuch or kiruv -- the star's twin.
 *
 * The book sits on every row beside the star: grey when he is not flagged,
 * violet when he is. Pressing it opens one prompt -- "what does he do" -- and
 * the answer is required, because a bare flag throws away the part a rebbe
 * actually wants. That text then shows next to his name everywhere.
 *
 * Shared state, like the star, so flagging him in the feed fills the book in
 * the list too without either screen reloading. Optimistic, and it rolls back
 * if the write is refused.
 *
 * Anyone approved may set it. It is something a rebbe knows about his own guys,
 * and a wrong flag misinforms nobody outside the app.
 */

type Entry = { on: boolean; role: string };

type ChinuchState = {
  entry: (id: number) => Entry;
  openEditor: (id: number) => void;
};

const Ctx = createContext<ChinuchState>({
  entry: () => ({ on: false, role: '' }),
  openEditor: () => {},
});

export const useChinuch = () => useContext(Ctx);

export function ChinuchProvider({
  directory,
  onChanged,
  children,
}: {
  directory: Directory | null;
  onChanged: () => void;
  children: React.ReactNode;
}) {
  const [map, setMap] = useState<Map<number, Entry>>(new Map());
  const [editing, setEditing] = useState<number | null>(null);

  // Seeded from the directory, re-seeded whenever it reloads.
  useEffect(() => {
    if (!directory) return;
    const m = new Map<number, Entry>();
    for (const p of directory.people) {
      const q = p as { in_chinuch?: boolean; chinuch_role?: string | null };
      if (q.in_chinuch) m.set(p.id, { on: true, role: q.chinuch_role ?? '' });
    }
    setMap(m);
  }, [directory]);

  const entry = (id: number): Entry => map.get(id) ?? { on: false, role: '' };

  async function save(id: number, on: boolean, role: string) {
    const before = map.get(id);
    setMap((prev) => {
      const next = new Map(prev);
      if (on) next.set(id, { on: true, role: role.trim() });
      else next.delete(id);
      return next;
    });

    const { error } = await supabase.rpc('set_chinuch', {
      p_person_id: id,
      p_in: on,
      p_role: role,
    });

    if (error) {
      // Roll back to exactly what it was.
      setMap((prev) => {
        const next = new Map(prev);
        if (before) next.set(id, before);
        else next.delete(id);
        return next;
      });
      return;
    }
    onChanged();
  }

  return (
    <Ctx.Provider value={{ entry, openEditor: setEditing }}>
      {children}
      <ChinuchEditor
        personId={editing}
        current={editing != null ? entry(editing) : { on: false, role: '' }}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </Ctx.Provider>
  );
}

/** The book on a row. Grey until flagged, violet after. */
export function ChinuchStar({ personId, size = 19 }: { personId: number; size?: number }) {
  const { entry, openEditor } = useChinuch();
  const on = entry(personId).on;
  return (
    <TouchableOpacity
      style={styles.book}
      hitSlop={8}
      onPress={() => openEditor(personId)}
      accessibilityLabel={on ? 'In chinuch or kiruv' : 'Mark as in chinuch or kiruv'}
      accessibilityRole="button"
    >
      <MaterialCommunityIcons
        name="book-open-variant"
        size={size}
        color={on ? colors.chinuch : colors.muted}
        style={!on ? styles.off : undefined}
      />
    </TouchableOpacity>
  );
}

/** Icon plus label, for the record screen. */
export function ChinuchChip({ personId }: { personId: number }) {
  const { entry, openEditor } = useChinuch();
  const e = entry(personId);
  return (
    <TouchableOpacity
      style={[styles.chip, e.on && styles.chipOn]}
      onPress={() => openEditor(personId)}
    >
      <MaterialCommunityIcons
        name="book-open-variant"
        size={15}
        color={e.on ? colors.navy900 : colors.chinuch}
      />
      <Text style={[styles.chipText, e.on && styles.chipTextOn]} numberOfLines={1}>
        {e.on ? e.role || 'In chinuch' : 'Mark chinuch / kiruv'}
      </Text>
    </TouchableOpacity>
  );
}

function ChinuchEditor({
  personId,
  current,
  onClose,
  onSave,
}: {
  personId: number | null;
  current: Entry;
  onClose: () => void;
  onSave: (id: number, on: boolean, role: string) => Promise<void>;
}) {
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);

  // Fill from the current value each time it opens.
  useEffect(() => {
    setRole(current.role);
  }, [personId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (personId == null) return null;

  async function commit(on: boolean) {
    setBusy(true);
    await onSave(personId!, on, role);
    setBusy(false);
    onClose();
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Chinuch / kiruv</Text>
            <TouchableOpacity onPress={onClose}>
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
            onPress={() => commit(true)}
          >
            {busy ? (
              <ActivityIndicator color={colors.navy900} size="small" />
            ) : (
              <Text style={styles.saveText}>{current.on ? 'Update' : 'He is in chinuch'}</Text>
            )}
          </TouchableOpacity>

          {current.on ? (
            <TouchableOpacity style={styles.clear} disabled={busy} onPress={() => commit(false)}>
              <Text style={styles.clearText}>He is not — remove the flag</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  book: { paddingHorizontal: 4, paddingVertical: 2 },
  off: { opacity: 0.45 },

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
