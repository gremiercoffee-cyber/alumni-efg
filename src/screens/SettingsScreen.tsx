import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import TopBar from '../components/TopBar';
import { COLORS, FONTS } from '../constants';
import { AppSettings } from '../types';
import { transcribeAudio } from '../lib/transcribe';

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
}

const SECTIONS: { key: keyof AppSettings; label: string; placeholder: string }[] = [
  {
    key: 'areas',
    label: 'Main areas of my life',
    placeholder: 'e.g. Gremier Coffee (my business), Yeshiva (I\'m a rabbi there), and Family. Keep these as the top-level folders.',
  },
  {
    key: 'schedule',
    label: 'Daily schedule',
    placeholder: 'e.g. Mornings I\'m at the production space. Afternoons are Yeshiva — shiur from 2 to 4. Evenings are deliveries or admin.',
  },
  {
    key: 'coffee',
    label: 'Coffee business — what I do',
    placeholder: 'e.g. I handle production, bottling, store deliveries, and the admin panel myself.',
  },
  {
    key: 'coffeePeople',
    label: 'Coffee business — people I deal with',
    placeholder: 'e.g. Names of suppliers, store contacts, delivery partners.',
  },
  {
    key: 'yeshiva',
    label: 'Yeshiva — what I do',
    placeholder: 'e.g. I\'m a rabbi — regular check-ins with students, shiur prep.',
  },
  {
    key: 'yeshivaPeople',
    label: 'Yeshiva — people I deal with',
    placeholder: 'e.g. Names of students or colleagues you talk with regularly.',
  },
  {
    key: 'urgency',
    label: 'How urgency works for me',
    placeholder: 'e.g. Anything supplier or money related, treat as same-day. Student matters can usually wait a day or two.',
  },
  {
    key: 'vocabulary',
    label: 'Words and terms to know',
    placeholder: 'e.g. Hebrew/Yiddish terms I use, product names, nicknames for people or places.',
  },
  {
    key: 'privacy',
    label: 'What should stay private',
    placeholder: 'e.g. Anything I say about X topic should not be filed or summarized.',
  },
];

function MicSection({
  label,
  placeholder,
  value,
  onChange,
  openaiKey,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  openaiKey: string;
}) {
  const [recording, setRecording] = useState(false);
  const recordingRef = React.useRef<Audio.Recording | null>(null);

  const toggleMic = async () => {
    if (recording) {
      setRecording(false);
      try {
        if (!recordingRef.current) return;
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        if (!uri) return;
        if (!openaiKey) {
          Alert.alert('No API key', 'Add your OpenAI key below first.');
          return;
        }
        const transcript = await transcribeAudio(uri, openaiKey);
        onChange(value ? value + ' ' + transcript : transcript);
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    } else {
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) return;
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: rec } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = rec;
        setRecording(true);
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.brownFaint}
          multiline
          numberOfLines={3}
        />
        <TouchableOpacity
          style={[styles.micBtn, recording && styles.micBtnActive]}
          onPress={toggleMic}
          activeOpacity={0.7}
        >
          <Text style={styles.micIcon}>{recording ? '◼' : '🎙'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SettingsScreen({ settings, onSave }: Props) {
  const [draft, setDraft] = useState<AppSettings>({ ...settings });

  const update = (key: keyof AppSettings, val: string) => {
    setDraft(d => ({ ...d, [key]: val }));
  };

  const save = () => {
    onSave(draft);
    Alert.alert('Saved', 'Settings saved.');
  };

  return (
    <View style={styles.container}>
      <TopBar subtitle="Configure" title="Settings" />
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.intro}>
          Fill in these sections — tap the mic on any box and just talk. The more context you give, the better it files notes and guesses reminder times.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OPENAI API KEY (for transcription)</Text>
          <TextInput
            style={[styles.input, styles.keyInput]}
            value={draft.openaiKey}
            onChangeText={v => update('openaiKey', v)}
            placeholder="sk-..."
            placeholderTextColor={COLORS.brownFaint}
            autoCapitalize="none"
            secureTextEntry
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ANTHROPIC API KEY (for organizing)</Text>
          <TextInput
            style={[styles.input, styles.keyInput]}
            value={draft.anthropicKey}
            onChangeText={v => update('anthropicKey', v)}
            placeholder="sk-ant-..."
            placeholderTextColor={COLORS.brownFaint}
            autoCapitalize="none"
            secureTextEntry
          />
        </View>

        {SECTIONS.map(s => (
          <MicSection
            key={s.key}
            label={s.label}
            placeholder={s.placeholder}
            value={draft[s.key]}
            onChange={v => update(s.key, v)}
            openaiKey={draft.openaiKey}
          />
        ))}

        <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>Save preferences</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 40 },
  intro: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownLight,
    lineHeight: 19,
    marginBottom: 20,
  },
  section: { marginBottom: 18 },
  sectionLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.white60,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    fontSize: FONTS.size.md,
    color: COLORS.brown,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  keyInput: {
    minHeight: 44,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  micBtnActive: { backgroundColor: COLORS.red },
  micIcon: { fontSize: 16 },
  saveBtn: {
    marginTop: 8,
    backgroundColor: COLORS.brown,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: FONTS.size.md,
    color: '#f6f1e3',
    fontWeight: '600',
  },
});
