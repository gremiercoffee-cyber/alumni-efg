import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

type Tab = 'home' | 'folders' | 'actions' | 'settings';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'folders', label: 'Folders', icon: '▤' },
  { id: 'actions', label: 'Actions', icon: '✓' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
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
          <Text style={[styles.label, active === t.id && styles.labelActive]}>
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
  },
  icon: {
    fontSize: 18,
    color: COLORS.brownFaint,
  },
  iconActive: {
    color: COLORS.brown,
  },
  label: {
    fontSize: 10,
    color: COLORS.brownFaint,
  },
  labelActive: {
    color: COLORS.brown,
    fontWeight: '600',
  },
});
