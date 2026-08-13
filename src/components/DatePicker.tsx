import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, radius, space, type } from '../theme';

/**
 * A calendar, written in plain React Native.
 *
 * Deliberately not @react-native-community/datetimepicker: that is a native
 * module, and adding one trades a 30-second update for a new APK on a phone
 * that is rarely on wifi. This costs a screenful of code and ships instantly.
 *
 * It also behaves the same everywhere, which the native pickers do not -- the
 * Android dialog and the iOS wheel and the browser's own date input are three
 * different interactions, and the app has to work on all three.
 *
 * Values are ISO dates (YYYY-MM-DD) throughout, never Date objects: a Date
 * carries a time and a timezone, and both have already caused a wedding to
 * land on the wrong day once.
 */

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const todayIso = () => {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth(), n.getDate());
};

/** Parsed as local parts, not as an instant. */
function parts(value: string | null): { y: number; m: number; d: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  return { y, m: m - 1, d };
}

export function prettyDate(value: string | null): string | null {
  const p = parts(value);
  if (!p) return null;
  return `${p.d} ${MONTHS[p.m].slice(0, 3)} ${p.y}`;
}

/**
 * The field itself: shows the chosen date, opens the calendar when tapped.
 */
export default function DateField({
  value,
  onChange,
  placeholder = 'Pick a date',
  style,
}: {
  value: string | null;
  onChange: (next: string) => void;
  placeholder?: string;
  style?: object;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={[styles.field, style]} onPress={() => setOpen(true)}>
        <MaterialCommunityIcons name="calendar" size={16} color={colors.cyan} />
        <Text style={value ? styles.fieldValue : styles.fieldPlaceholder}>
          {prettyDate(value) ?? placeholder}
        </Text>
      </TouchableOpacity>
      <Calendar
        visible={open}
        value={value}
        onClose={() => setOpen(false)}
        onPick={(next) => {
          onChange(next);
          setOpen(false);
        }}
      />
    </>
  );
}

function Calendar({
  visible, value, onClose, onPick,
}: {
  visible: boolean;
  value: string | null;
  onClose: () => void;
  onPick: (iso: string) => void;
}) {
  const start = parts(value) ?? parts(todayIso())!;
  // Which month is on screen. Reset whenever the field is reopened, so it
  // always lands on the chosen date rather than wherever it was left.
  const [cursor, setCursor] = useState({ y: start.y, m: start.m });
  const [seen, setSeen] = useState(visible);
  if (visible !== seen) {
    setSeen(visible);
    if (visible) setCursor({ y: start.y, m: start.m });
  }

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1).getDay();
    const length = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= length; d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [cursor]);

  const shift = (by: number) => {
    const m = cursor.m + by;
    setCursor({ y: cursor.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  const today = todayIso();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          <View style={styles.head}>
            <TouchableOpacity onPress={() => shift(-1)} hitSlop={12} style={styles.arrow}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.cyan} />
            </TouchableOpacity>
            {/* Tapping the year steps it, which beats twelve taps to reach
                next November. */}
            <View style={styles.headMid}>
              <Text style={styles.month}>{MONTHS[cursor.m]}</Text>
              <View style={styles.yearRow}>
                <TouchableOpacity onPress={() => shift(-12)} hitSlop={10}>
                  <Text style={styles.yearStep}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.year}>{cursor.y}</Text>
                <TouchableOpacity onPress={() => shift(12)} hitSlop={10}>
                  <Text style={styles.yearStep}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={() => shift(1)} hitSlop={12} style={styles.arrow}>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.cyan} />
            </TouchableOpacity>
          </View>

          <View style={styles.week}>
            {DAYS.map((d, i) => (
              <Text key={i} style={styles.dayName}>{d}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {grid.map((d, i) => {
              if (d === null) return <View key={i} style={styles.cell} />;
              const cellIso = iso(cursor.y, cursor.m, d);
              const chosen = cellIso === value;
              const isToday = cellIso === today;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.cell, chosen && styles.cellOn]}
                  onPress={() => onPick(cellIso)}
                >
                  <Text
                    style={[
                      styles.cellText,
                      isToday && !chosen && styles.cellToday,
                      chosen && styles.cellTextOn,
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.foot}>
            <TouchableOpacity onPress={() => onPick(today)}>
              <Text style={styles.footAction}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.footClose}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  fieldValue: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: colors.white },
  fieldPlaceholder: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: colors.muted,
    opacity: 0.7,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.navy900,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: 16,
    padding: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headMid: { alignItems: 'center', gap: 1 },
  arrow: { padding: 4 },
  month: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.white },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  year: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.muted },
  yearStep: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: colors.cyan },

  week: { flexDirection: 'row', marginTop: space.sm },
  dayName: {
    ...type.label,
    flex: 1,
    textAlign: 'center',
    fontSize: 9.5,
    color: colors.muted,
    opacity: 0.7,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  cellOn: { backgroundColor: colors.cyan },
  cellText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: colors.white },
  cellToday: { color: colors.cyan, fontFamily: 'Poppins_700Bold' },
  cellTextOn: { color: colors.navy900, fontFamily: 'Poppins_700Bold' },

  foot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.ruleOnNavy,
  },
  footAction: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: colors.cyan },
  footClose: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: colors.muted },
});
