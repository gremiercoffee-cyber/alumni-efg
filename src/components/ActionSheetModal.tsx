import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS } from '../constants';

export interface ActionSheetOption {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
  onCancel: () => void;
}

export default function ActionSheetModal({
  visible,
  title,
  message,
  options,
  cancelLabel = 'Cancel',
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {options.map(option => (
              <TouchableOpacity
                key={option.label}
                style={styles.option}
                onPress={option.onPress}
                activeOpacity={0.82}
              >
                <Text style={[styles.optionText, option.destructive && styles.destructiveText]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.82}>
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 36, 29, 0.28)',
  },
  sheetWrap: {
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderRadius: 22,
    paddingTop: 14,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  title: {
    fontSize: FONTS.size.sm,
    color: COLORS.brown,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  message: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 8,
  },
  option: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  optionText: {
    fontSize: FONTS.size.lg,
    color: COLORS.brown,
    fontWeight: '600',
  },
  destructiveText: {
    color: COLORS.red,
  },
  cancelBtn: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: COLORS.bg,
  },
  cancelText: {
    fontSize: FONTS.size.lg,
    color: COLORS.brown,
    fontWeight: '700',
  },
});
