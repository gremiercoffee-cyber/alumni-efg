import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { COLORS, FONTS } from '../constants';

interface Props {
  callMode: boolean;
  target?: 'note' | 'keeper';
  onBeginProcessing: () => void;
  onError: (message: string) => void;
  onComplete: (audioUri: string) => void;
}

const recordingOptions: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

export default function RecordingScreen({
  callMode,
  target = 'note',
  onBeginProcessing,
  onError,
  onComplete,
}: Props) {
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);

  const reportError = (prefix: string, err: unknown) => {
    const details =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : typeof err === 'string'
        ? err
        : JSON.stringify(err);
    const message = details ? `${prefix} ${details}` : prefix;
    console.error(prefix, err);
    setError(message);
    onError(message);
  };

  useEffect(() => {
    startPromiseRef.current = startRecording();
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);

      const permission = await Audio.requestPermissionsAsync();
      console.log('Audio.requestPermissionsAsync result', permission);

      if (!permission.granted) {
        const msg =
          'Microphone access is off. Open Android Settings > Apps > NoteKeeper > Permissions and enable Microphone, then try again.';
        setError(msg);
        onError(msg);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      console.log('Audio mode configured for recording');

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      console.log('Audio recording created successfully', { callMode, target });
      recordingRef.current = recording;
    } catch (e: unknown) {
      reportError('Could not start recording.', e);
    }
  };

  const stopRecording = async () => {
    if (stopping) return;

    setStopping(true);
    setError(null);
    onBeginProcessing();
    console.log('Stop recording tapped');

    if (startPromiseRef.current) {
      await startPromiseRef.current;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    try {
      if (!recordingRef.current) {
        setStopping(false);
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
    } catch (e: unknown) {
      reportError('Error stopping recording.', e);
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

      <Text style={styles.timer}>
        {mm}:{ss}
      </Text>

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
          {stopping ? (
            <View style={styles.processingWrap}>
              <ActivityIndicator size="large" color={COLORS.brown} />
              <Text style={styles.processingText}>Saving recording...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={stopRecording}
              activeOpacity={0.8}
            >
              <Text style={styles.stopIcon}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.hint}>
        {stopping
          ? 'One moment while the recording is saved.'
          : callMode
          ? 'Listening through the speaker, tap to stop.'
          : 'Tap to stop. Recording continues if you switch apps.'}
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
  processingWrap: {
    minHeight: 124,
    minWidth: 124,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brown,
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
  stopIcon: {
    fontSize: 24,
    fontWeight: '600',
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
    maxWidth: 320,
    lineHeight: 20,
  },
});
