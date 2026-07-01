import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS, FONTS } from '../constants';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export default function TopBar({ title, subtitle, onBack }: Props) {
  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
      )}
      <View style={styles.text}>
        {subtitle && <Text style={styles.subtitle}>{subtitle.toUpperCase()}</Text>}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  backBtn: {
    marginRight: 8,
    marginLeft: -6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  backIcon: {
    fontSize: 28,
    color: COLORS.brownMid,
    lineHeight: 32,
  },
  text: {
    flex: 1,
  },
  subtitle: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 1.4,
    marginBottom: 1,
  },
  title: {
    fontSize: FONTS.size.lg,
    fontWeight: '600',
    color: COLORS.brown,
  },
});
