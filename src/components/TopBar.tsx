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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 18,
    top: 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: COLORS.brownMid,
    lineHeight: 32,
  },
  text: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  subtitle: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 1.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.brown,
    textAlign: 'center',
  },
});
