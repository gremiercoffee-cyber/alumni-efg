import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Audio } from 'expo-av';
import { COLORS, FONTS } from '../constants';

interface Props {
  callMode: boolean;
  onComplete: (audioUri: string) => void;
}

export default function RecordingScreen({ callMode, onComplete }: Props) {
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startRecording();
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError('Microphone permission denied. Enable it in Android Settings.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
    } catch (e: any) {
      setError('Could not start recording: ' + e.message);
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      if (!recordingRef.current) return;
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (uri) onComplete(uri);
    } catch (e: any) {
      setError('Error stopping recording: ' + e.message);
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View style={styles.dot} />
        <Text style={styles.statusText}>
          {callMode ? 'Recording call (speaker)' : 'Recording'}
        </Text>
      </View>

      <Text style={styles.timer}>{mm}:{ss}</Text>

      <View style={styles.waveform}>
        {[...Array(18)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: 20 + Math.sin(i * 1.3 + seconds) * 12 + 12,
              },
            ]}
          />
        ))}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <TouchableOpacity style={styles.stopBtn} onPress={stopRecording} activeOpacity={0.8}>
          <Text style={styles.stopIcon}>◼</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.hint}>
        {callMode
          ? 'Listening through the speaker · tap to stop'
          : 'Tap to stop · keeps recording if you switch apps'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 32,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.red,
  },
  statusText: {
    fontSize: FONTS.size.md,
    color: COLORS.red,
    letterSpacing: 0.5,
  },
  timer: {
    fontSize: 52,
    fontWeight: '300',
    color: COLORS.brown,
    fontVariant: ['tabular-nums'],
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 48,
  },
  bar: {
    width: 5,
    backgroundColor: '#c9b98f',
    borderRadius: 3,
  },
  stopBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  stopIcon: {
    fontSize: 26,
    color: '#fff',
  },
  hint: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    textAlign: 'center',
  },
  error: {
    fontSize: FONTS.size.sm,
    color: COLORS.red,
    textAlign: 'center',
  },
});
