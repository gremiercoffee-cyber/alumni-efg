import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS } from '../constants';

export interface ScheduleEntry {
  id: string;
  title: string;
  subtitle: string;
  due: string;
  bucket: 'today' | 'soon' | 'later';
}

interface Props {
  visible: boolean;
  routineText: string;
  entries: ScheduleEntry[];
  onClose: () => void;
}

interface CalendarDay {
  label: number;
  isoDate: string;
  entries: ScheduleEntry[];
  isCurrentMonth: boolean;
}

function parseEntryDate(due: string): Date | null {
  const parsed = Date.parse(due);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function ScheduleDrawer({ visible, routineText, entries, onClose }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const calendarDays = useMemo(() => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - start.getDay());
    const gridEnd = new Date(end);
    gridEnd.setDate(end.getDate() + (6 - end.getDay()));

    const days: CalendarDay[] = [];
    for (const date = new Date(gridStart); date <= gridEnd; date.setDate(date.getDate() + 1)) {
      const current = new Date(date);
      const dayEntries = entries.filter(entry => {
        const parsed = parseEntryDate(entry.due);
        return parsed ? sameDay(parsed, current) : false;
      });
      days.push({
        label: current.getDate(),
        isoDate: current.toISOString(),
        entries: dayEntries,
        isCurrentMonth: current.getMonth() === currentMonth.getMonth(),
      });
    }
    return days;
  }, [currentMonth, entries]);

  const monthLabel = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const monthEntries = useMemo(() => {
    return entries
      .filter(entry => {
        const parsed = parseEntryDate(entry.due);
        return parsed
          ? parsed.getMonth() === currentMonth.getMonth() &&
              parsed.getFullYear() === currentMonth.getFullYear()
          : true;
      })
      .sort((a, b) => {
        const first = parseEntryDate(a.due)?.getTime() || 0;
        const second = parseEntryDate(b.due)?.getTime() || 0;
        return first - second;
      });
  }, [currentMonth, entries]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() =>
              setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
            }
            activeOpacity={0.8}
          >
            <Text style={styles.navText}>Prev</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Schedule</Text>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
            }
            activeOpacity={0.8}
          >
            <Text style={styles.navText}>Next</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {routineText ? (
            <View style={styles.routineCard}>
              <Text style={styles.sectionLabel}>LEARNED ROUTINE</Text>
              <Text style={styles.routineText}>{routineText}</Text>
            </View>
          ) : null}

          <View style={styles.calendarCard}>
            <Text style={styles.sectionLabel}>MONTH VIEW</Text>
            <View style={styles.weekHeader}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <Text key={day} style={styles.weekHeaderText}>{day}</Text>
              ))}
            </View>
            <View style={styles.grid}>
              {calendarDays.map(day => (
                <View
                  key={day.isoDate}
                  style={[styles.dayCell, !day.isCurrentMonth && styles.dayCellMuted]}
                >
                  <Text style={[styles.dayNumber, !day.isCurrentMonth && styles.dayNumberMuted]}>
                    {day.label}
                  </Text>
                  {day.entries.slice(0, 2).map(entry => (
                    <View key={entry.id} style={styles.dayDotWrap}>
                      <Text style={styles.dayDot} numberOfLines={1}>• {entry.title}</Text>
                    </View>
                  ))}
                  {day.entries.length > 2 ? (
                    <Text style={styles.moreText}>+{day.entries.length - 2} more</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.listCard}>
            <Text style={styles.sectionLabel}>THIS MONTH</Text>
            {monthEntries.length === 0 ? (
              <Text style={styles.empty}>No scheduled items yet.</Text>
            ) : (
              monthEntries.map(entry => (
                <View key={entry.id} style={styles.entryCard}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.entrySubtitle}>{entry.subtitle}</Text>
                  <Text style={styles.entryDue}>{entry.due}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.closeText}>Close schedule</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.brown,
  },
  monthLabel: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownLight,
    marginTop: 2,
  },
  navText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brown,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingBottom: 110,
    gap: 14,
  },
  routineCard: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  routineText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownMid,
    lineHeight: 20,
  },
  calendarCard: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.brownLight,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayCell: {
    width: '13.4%',
    minHeight: 76,
    backgroundColor: COLORS.bgAlt,
    borderRadius: 10,
    padding: 6,
  },
  dayCellMuted: {
    opacity: 0.45,
  },
  dayNumber: {
    fontSize: 12,
    color: COLORS.brown,
    fontWeight: '700',
    marginBottom: 4,
  },
  dayNumberMuted: {
    color: COLORS.brownLight,
  },
  dayDotWrap: {
    marginBottom: 2,
  },
  dayDot: {
    fontSize: 8,
    color: COLORS.brownMid,
  },
  moreText: {
    fontSize: 8,
    color: COLORS.brownLight,
    marginTop: 2,
  },
  listCard: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 14,
  },
  entryCard: {
    backgroundColor: COLORS.bgAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  entryTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.brown,
  },
  entrySubtitle: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    marginTop: 3,
  },
  entryDue: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    marginTop: 6,
  },
  empty: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownFaint,
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: COLORS.brown,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeText: {
    color: COLORS.bg,
    fontSize: FONTS.size.md,
    fontWeight: '700',
  },
});
