import React, { ReactNode } from 'react';
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
  rightAction?: ReactNode;
}

export default function TopBar({ title, subtitle, onBack, rightAction }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.sideSlot}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backIcon}>{'<'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.sideSpacer} />
        )}
      </View>
      <View style={styles.text}>
        {subtitle && <Text style={styles.subtitle}>{subtitle.toUpperCase()}</Text>}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      <View style={styles.sideSlot}>{rightAction || <View style={styles.sideSpacer} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: COLORS.bg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideSlot: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSpacer: {
    width: 36,
    height: 36,
  },
  backBtn: {
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  subtitle: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 1.4,
    marginBottom: 4,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.brown,
    textAlign: 'center',
  },
});
