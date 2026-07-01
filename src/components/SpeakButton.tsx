import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech';
import { COLORS } from '../constants';

interface Props {
  text: string;
}

export default function SpeakButton({ text }: Props) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const toggle = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    Speech.stop();
    Speech.speak(text, {
      onDone: () => setSpeaking(false),
      onError: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
    });
    setSpeaking(true);
  };

  return (
    <TouchableOpacity
      onPress={toggle}
      style={[styles.btn, speaking && styles.btnActive]}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={[styles.icon, speaking && styles.iconActive]}>
        {speaking ? '◼' : '▶'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: COLORS.red,
  },
  icon: {
    fontSize: 11,
    color: COLORS.brownMid,
  },
  iconActive: {
    color: '#fff',
  },
});
