import React from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { colors, radius, space, type } from '../theme';

/** Top inset. Android does not honour SafeAreaView, and the web has no notch. */
export const topInset =
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : Platform.OS === 'ios' ? 44 : 12;

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, active && styles.chipOn]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ChipRow({
  children,
  label,
  sub,
}: {
  children: React.ReactNode;
  label?: string;
  sub?: boolean;
}) {
  return (
    <View style={[styles.chipRowWrap, sub && styles.chipRowSub]}>
      {label ? <Text style={styles.within}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {children}
      </ScrollView>
    </View>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

export function Badge({
  children,
  tone = 'plain',
}: {
  children: React.ReactNode;
  tone?: 'plain' | 'cyan' | 'warn' | 'bad';
}) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{children}</Text>
    </View>
  );
}

export function Section({
  title,
  footnote,
  children,
  style,
}: {
  title: string;
  footnote?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.section, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </View>
  );
}

export const Prose = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.prose}>{children}</Text>
);

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.empty}>{children}</Text>
);

const styles = StyleSheet.create({
  chipRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleOnNavy,
    gap: space.sm,
  },
  chipRowSub: { backgroundColor: 'rgba(20,49,116,0.35)' },
  chipRow: { gap: 6, paddingRight: space.md },
  within: {
    ...type.label,
    fontSize: 9,
    color: colors.muted,
    opacity: 0.7,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipOn: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  chipText: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.muted },
  chipTextOn: { fontFamily: 'Poppins_600SemiBold', color: colors.navy900 },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.navy700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: colors.cyan },

  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.navy700,
  },
  badge_plain: {},
  badge_cyan: { backgroundColor: 'rgba(47,224,210,0.16)' },
  badge_warn: { backgroundColor: 'rgba(255,209,102,0.16)' },
  badge_bad: { backgroundColor: 'rgba(255,154,168,0.16)' },
  badgeText: { ...type.label, fontSize: 10, color: colors.muted },
  badgeText_plain: {},
  badgeText_cyan: { color: colors.cyan },
  badgeText_warn: { color: colors.warn },
  badgeText_bad: { color: colors.bad },

  section: {
    paddingHorizontal: space.md,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleOnNavy,
    gap: space.sm,
  },
  sectionTitle: { ...type.label, color: colors.cyan },
  footnote: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: colors.muted,
    opacity: 0.65,
    fontStyle: 'italic',
  },
  prose: { ...type.body, color: colors.muted },
  empty: {
    ...type.body,
    color: colors.muted,
    opacity: 0.7,
    textAlign: 'center',
    padding: space.xl,
  },
});
