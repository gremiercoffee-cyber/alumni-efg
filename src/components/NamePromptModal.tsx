import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS } from '../constants';

interface Props {
  visible: boolean;
  title: string;
  placeholder: string;
  value: string;
  confirmLabel?: string;
  onChangeText: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function NamePromptModal({
  visible,
  title,
  placeholder,
  value,
  confirmLabel = 'Save',
  onChangeText,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.box} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={COLORS.brownFaint}
            value={value}
            onChangeText={onChangeText}
            autoFocus
            onSubmitEditing={onConfirm}
            returnKeyType="done"
          />
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.82}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.82}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  box: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.bg,
    borderRadius: 18,
    padding: 20,
  },
  title: {
    fontSize: FONTS.size.lg,
    fontWeight: '700',
    color: COLORS.brown,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: FONTS.size.md,
    color: COLORS.brown,
    marginBottom: 16,
    backgroundColor: COLORS.white60,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: FONTS.size.md,
    color: COLORS.brownFaint,
  },
  confirmBtn: {
    backgroundColor: COLORS.brown,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmText: {
    fontSize: FONTS.size.md,
    color: COLORS.bg,
    fontWeight: '700',
  },
});
