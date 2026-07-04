import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

type Tab = 'schedule' | 'notes' | 'keeper' | 'todos' | 'settings';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'schedule', label: 'Schedule', icon: 'C' },
  { id: 'notes', label: 'Notes', icon: 'N' },
  { id: 'keeper', label: 'Keeper', icon: 'K' },
  { id: 'todos', label: 'To-Dos', icon: 'T' },
  { id: 'settings', label: 'Settings', icon: 'S' },
];

export default function TabBar({ active, onChange }: Props) {
  return (
    <View style={styles.container}>
      {TABS.map(t => (
        <TouchableOpacity
          key={t.id}
          style={styles.tab}
          onPress={() => onChange(t.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.icon, active === t.id && styles.iconActive]}>
            {t.icon}
          </Text>
          <Text style={[styles.label, active === t.id && styles.labelActive]} numberOfLines={1}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bgAlt,
    paddingBottom: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    gap: 2,
    minWidth: 0,
  },
  icon: {
    fontSize: 14,
    color: COLORS.brownFaint,
    fontWeight: '700',
  },
  iconActive: {
    color: COLORS.brown,
  },
  label: {
    fontSize: 9,
    color: COLORS.brownFaint,
  },
  labelActive: {
    color: COLORS.brown,
    fontWeight: '600',
  },
});
