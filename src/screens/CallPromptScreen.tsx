import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS, FONTS } from '../constants';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CallPromptScreen({ onConfirm, onCancel }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📞</Text>
      <Text style={styles.title}>Switch to speaker first</Text>
      <Text style={styles.body}>
        NoteKeeper records through the room mic, not the call itself — so flip
        your call to speakerphone, then start. It'll pick up your side clearly.
        {'\n\n'}
        The other person may be audible too if they're loud enough through the
        speaker.
      </Text>
      <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
        <Text style={styles.confirmText}>Speaker's on — start recording</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} activeOpacity={0.7} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 16,
  },
  icon: { fontSize: 32 },
  title: {
    fontSize: FONTS.size.xl,
    fontWeight: '600',
    color: COLORS.brown,
    textAlign: 'center',
  },
  body: {
    fontSize: FONTS.size.md,
    color: COLORS.brownMid,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmBtn: {
    marginTop: 8,
    backgroundColor: COLORS.brown,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
  },
  confirmText: {
    fontSize: FONTS.size.md,
    color: '#f6f1e3',
    fontWeight: '600',
  },
  cancelBtn: { paddingVertical: 8 },
  cancelText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownFaint,
  },
});
