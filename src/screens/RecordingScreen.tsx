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
  onBeginProcessing: () => void;
  onError: (message: string) => void;
  onComplete: (audioUri: string) => void;
}

export default function RecordingScreen({ callMode, onBeginProcessing, onError, onComplete }: Props) {
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
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
        const msg = 'Microphone permission denied. Enable it in Settings.';
        setError(msg);
        onError(msg);
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
      console.error('Could not start recording', e);
      const msg = 'Could not start recording: ' + e.message;
      setError(msg);
      onError(msg);
    }
  };

  const stopRecording = async () => {
    if (stopping) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setStopping(true);
    onBeginProcessing();
    console.log('Stop recording tapped');

    try {
      if (!recordingRef.current) {
        // Recording never started (start failed or was denied) — just go back
        onError('Recording could not start. Please try again.');
        return;
      }

      console.log('Stopping and unloading recording');
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      console.log('Recording stopped', uri);

      if (!uri) {
        throw new Error('Could not access the recorded audio file.');
      }

      onComplete(uri);
    } catch (e: any) {
      const message = 'Error stopping recording: ' + e.message;
      console.error('Error stopping recording', e);
      setError(message);
      onError(message);
      setStopping(false);
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View style={styles.dot} />
        <Text style={styles.statusText}>
          {stopping ? 'Preparing your note' : callMode ? 'Recording call (speaker)' : 'Recording'}
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
        <View style={styles.actionArea}>
          {stopping && <View style={styles.spinner} />}
          <TouchableOpacity
            style={[styles.stopBtn, stopping && styles.stopBtnDisabled]}
            onPress={stopRecording}
            activeOpacity={0.8}
            disabled={stopping}
          >
            <Text style={styles.stopIcon}>{stopping ? '...' : '■'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.hint}>
        {stopping
          ? 'One moment while the recording is saved.'
          : callMode
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
    gap: 26,
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
    fontSize: FONTS.size.sm,
    color: COLORS.red,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  timer: {
    fontSize: 64,
    fontWeight: '400',
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
  actionArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  spinner: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderTopColor: COLORS.brown,
  },
  stopBtn: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  stopBtnDisabled: {
    opacity: 0.9,
  },
  stopIcon: {
    fontSize: 32,
    color: '#fff',
  },
  hint: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownFaint,
    textAlign: 'center',
    maxWidth: 260,
  },
  error: {
    fontSize: FONTS.size.sm,
    color: COLORS.red,
    textAlign: 'center',
  },
});
