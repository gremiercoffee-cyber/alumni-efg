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
import { requestReminderPermissions } from '../lib/reminders';

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onSignOut: () => void;
}

const SECTIONS: { key: keyof AppSettings; label: string; placeholder: string }[] = [
  {
    key: 'areas',
    label: 'Main areas of my life',
    placeholder: 'e.g. Work, family, health, errands, projects. These can become your top-level note categories.',
  },
  {
    key: 'schedule',
    label: 'Daily schedule',
    placeholder: 'e.g. Mornings are focused work, afternoons are meetings, evenings are personal or family time.',
  },
  {
    key: 'coffee',
    label: 'Work and responsibilities',
    placeholder: 'e.g. I manage planning, communication, follow-ups, logistics, and day-to-day tasks.',
  },
  {
    key: 'coffeePeople',
    label: 'People I interact with',
    placeholder: 'e.g. Team members, clients, family members, service providers, collaborators.',
  },
  {
    key: 'yeshiva',
    label: 'Recurring commitments',
    placeholder: 'e.g. Regular meetings, appointments, classes, household responsibilities, or weekly routines.',
  },
  {
    key: 'yeshivaPeople',
    label: 'Important relationships',
    placeholder: 'e.g. People I check in with often or need to keep in mind when organizing notes.',
  },
  {
    key: 'urgency',
    label: 'How urgency works for me',
    placeholder: 'e.g. Time-sensitive messages should be same-day. Routine items can wait a little longer.',
  },
  {
    key: 'vocabulary',
    label: 'Words and terms to know',
    placeholder: 'e.g. Names, abbreviations, jargon, nicknames, or phrases I use a lot.',
  },
  {
    key: 'privacy',
    label: 'What should stay private',
    placeholder: 'e.g. Topics that should not be summarized, stored, or filed automatically.',
  },
];

function MicSection({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
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
        const transcript = await transcribeAudio(uri);
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
          <Text style={styles.micIcon}>{recording ? 'Stop' : 'Mic'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SettingsScreen({ settings, onSave, onSignOut }: Props) {
  const [draft, setDraft] = useState<AppSettings>({ ...settings });

  const update = (key: keyof AppSettings, val: string) => {
    setDraft(d => ({ ...d, [key]: val }));
  };

  const save = () => {
    onSave(draft);
    Alert.alert('Saved', 'Settings saved.');
  };

  const requestMicAccess = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      Alert.alert(
        permission.granted ? 'Microphone ready' : 'Microphone still off',
        permission.granted
          ? 'Recording should start much faster now.'
          : 'Enable Microphone in Android Settings > Apps > NoteKeeper > Permissions.'
      );
      setDraft(current => ({ ...current, microphonePermissionAsked: true }));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not request microphone permission.');
    }
  };

  const requestNotificationAccess = async () => {
    try {
      const granted = await requestReminderPermissions();
      Alert.alert(
        granted ? 'Reminders ready' : 'Notifications still off',
        granted
          ? 'To-do reminders can now send notifications.'
          : 'Enable notifications in Android Settings if you want reminders to alert you.'
      );
      setDraft(current => ({ ...current, notificationsPermissionAsked: true }));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not request notification permission.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TopBar subtitle="Configure" title="Settings" />
        <View style={styles.hero}>
          <Text style={styles.intro}>
            Fill in any sections that feel useful. You can tap the mic and talk naturally. The more general context you give, the better the app can organize notes and suggest reminders.
          </Text>
        </View>

        <View style={styles.permissionRow}>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestMicAccess} activeOpacity={0.8}>
            <Text style={styles.permissionBtnText}>Enable microphone</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestNotificationAccess} activeOpacity={0.8}>
            <Text style={styles.permissionBtnText}>Enable reminders</Text>
          </TouchableOpacity>
        </View>

        {SECTIONS.map(s => (
          <MicSection
            key={s.key}
            label={s.label}
            placeholder={s.placeholder}
            value={draft[s.key]}
            onChange={v => update(s.key, v)}
          />
        ))}

        <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>Save preferences</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutBtnText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: {
    alignItems: 'center',
    paddingBottom: 18,
  },
  intro: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownLight,
    lineHeight: 19,
    marginBottom: 4,
    textAlign: 'center',
    maxWidth: 320,
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
  micIcon: { fontSize: 11, color: COLORS.brown },
  saveBtn: {
    marginTop: 18,
    backgroundColor: COLORS.brown,
    minHeight: 56,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: FONTS.size.md,
    color: '#f6f1e3',
    fontWeight: '600',
  },
  signOutBtn: {
    marginTop: 12,
    minHeight: 50,
    paddingVertical: 12,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white60,
  },
  signOutBtnText: {
    fontSize: FONTS.size.md,
    color: COLORS.brown,
    fontWeight: '600',
  },
  permissionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  permissionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.white60,
  },
  permissionBtnText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brown,
    fontWeight: '600',
  },
});
