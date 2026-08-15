import React, { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Directory } from './alumni';
import { supabase } from './supabase';
import { colors } from '../theme';

/**
 * Whose guys are whose, and the star that says so.
 *
 * Shared state rather than a prop threaded through every list, because the same
 * man shows up in the feed, in Contacts, in My alumni and on his own record --
 * and starring him in one place has to fill the star in all of them at once.
 * Passing it down would mean four screens reloading the whole directory to
 * agree about one boolean.
 *
 * Optimistic: the star fills the instant it is pressed and rolls back if the
 * write fails. Anything else feels broken on a phone with two bars of signal.
 */

type MineState = {
  staffId: number | null;
  isMine: (personId: number) => boolean;
  toggle: (personId: number) => void;
};

const Ctx = createContext<MineState>({
  staffId: null,
  isMine: () => false,
  toggle: () => {},
});

export const useMine = () => useContext(Ctx);

export function MineProvider({
  staffId,
  directory,
  onChanged,
  children,
}: {
  staffId: number | null;
  directory: Directory | null;
  onChanged: () => void;
  children: React.ReactNode;
}) {
  const [ids, setIds] = useState<Set<number>>(new Set());

  // Seeded from the directory, which already works out `mine` when it loads.
  // Re-seeded whenever it reloads, so a change made on another device shows up.
  useEffect(() => {
    if (!directory) return;
    setIds(
      new Set(
        directory.people
          .filter((p) => (p as { mine?: boolean }).mine)
          .map((p) => p.id),
      ),
    );
  }, [directory]);

  async function toggle(personId: number) {
    if (!staffId) return;
    const adding = !ids.has(personId);

    setIds((prev) => {
      const next = new Set(prev);
      if (adding) next.add(personId);
      else next.delete(personId);
      return next;
    });

    const { error } = adding
      ? await supabase.from('staff_connections').insert({ staff_id: staffId, person_id: personId })
      : await supabase
          .from('staff_connections')
          .delete()
          .eq('staff_id', staffId)
          .eq('person_id', personId);

    // A duplicate means he was already claimed, which is the state we wanted.
    if (error && !error.message.includes('duplicate')) {
      setIds((prev) => {
        const next = new Set(prev);
        if (adding) next.delete(personId);
        else next.add(personId);
        return next;
      });
      return;
    }
    onChanged();
  }

  return (
    <Ctx.Provider value={{ staffId, isMine: (id) => ids.has(id), toggle }}>
      {children}
    </Ctx.Provider>
  );
}

/**
 * The star. Filled if he is yours, hollow and grey if he is not.
 *
 * Nothing at all for someone with no rebbe attached to their login -- the admin
 * included. A star he cannot meaningfully fill is a button that does nothing.
 */
export function MineStar({ personId, size = 20 }: { personId: number; size?: number }) {
  const { staffId, isMine, toggle } = useMine();
  if (!staffId) return null;

  const mine = isMine(personId);
  return (
    <TouchableOpacity
      style={styles.star}
      hitSlop={8}
      onPress={() => toggle(personId)}
      accessibilityLabel={mine ? 'One of your guys' : 'Mark as one of your guys'}
      accessibilityRole="button"
    >
      <MaterialIcons
        name={mine ? 'star' : 'star-outline'}
        size={size}
        color={mine ? colors.star : colors.muted}
        style={!mine ? styles.off : undefined}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  star: { paddingHorizontal: 4, paddingVertical: 2 },
  off: { opacity: 0.45 },
});
