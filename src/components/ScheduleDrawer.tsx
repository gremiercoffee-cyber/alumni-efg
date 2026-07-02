import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
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

export default function ScheduleDrawer({ visible, routineText, entries, onClose }: Props) {
  const today = entries.filter(entry => entry.bucket === 'today');
  const soon = entries.filter(entry => entry.bucket === 'soon');
  const later = entries.filter(entry => entry.bucket === 'later');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.drawer}>
          <View style={styles.header}>
            <Text style={styles.title}>Schedule</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {routineText ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>ROUTINE</Text>
                <Text style={styles.routine}>{routineText}</Text>
              </View>
            ) : null}

            <Section title="TODAY" entries={today} emptyText="Nothing due today yet." />
            <Section title="COMING UP" entries={soon} emptyText="Nothing scheduled soon." />
            <Section title="LATER" entries={later} emptyText="Nothing parked for later." />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Section({
  title,
  entries,
  emptyText,
}: {
  title: string;
  entries: ScheduleEntry[];
  emptyText: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        entries.map(entry => (
          <View key={entry.id} style={styles.card}>
            <Text style={styles.cardTitle}>{entry.title}</Text>
            <Text style={styles.cardSubtitle}>{entry.subtitle}</Text>
            <Text style={styles.cardDue}>{entry.due}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  backdrop: {
    flex: 1,
  },
  drawer: {
    width: '82%',
    maxWidth: 360,
    backgroundColor: COLORS.bg,
    paddingTop: 28,
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.brown,
  },
  closeBtn: {
    paddingVertical: 6,
  },
  closeText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownLight,
  },
  content: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  routine: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownMid,
    lineHeight: 20,
  },
  empty: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownFaint,
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.brown,
  },
  cardSubtitle: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    marginTop: 3,
  },
  cardDue: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    marginTop: 6,
  },
});
