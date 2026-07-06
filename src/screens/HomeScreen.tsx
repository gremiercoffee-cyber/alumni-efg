import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  StyleSheet,
} from 'react-native';
import TopBar from '../components/TopBar';
import SpeakButton from '../components/SpeakButton';
import { COLORS, FONTS } from '../constants';
import { formatDate } from '../utils';
import { Note } from '../types';

const shareNote = (n: Note) =>
  Share.share({ title: n.title, message: `${n.title}\n\n${n.summary}` });

interface Props {
  notes: Note[];
  error: string | null;
  onRecordTap: () => void;
  onCallRecordTap: () => void;
  showToast: boolean;
  onToastTap?: () => void;
}

export default function HomeScreen({
  notes,
  error,
  onRecordTap,
  onCallRecordTap,
  showToast,
  onToastTap,
}: Props) {
  const recent = notes.slice(0, 3);

  return (
    <View style={styles.container}>
      <TopBar
        subtitle={new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
        title="NoteKeeper"
      />

      {showToast && onToastTap && (
        <TouchableOpacity style={styles.toast} onPress={onToastTap} activeOpacity={0.85}>
          <Text style={styles.toastIcon}>🎙</Text>
          <View style={styles.toastText}>
            <Text style={styles.toastTitle}>Note ready - tap to review</Text>
            <Text style={styles.toastSub}>Action items found · confirm placement</Text>
          </View>
        </TouchableOpacity>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.hero}>
        <Text style={styles.tagline}>Press and it listens.{'\n'}It figures out the rest.</Text>

        <TouchableOpacity style={styles.micBtn} onPress={onRecordTap} activeOpacity={0.8}>
          <Text style={styles.micIcon}>🎙</Text>
        </TouchableOpacity>

        <Text style={styles.micLabel}>Tap to start recording</Text>

        <TouchableOpacity style={styles.callBtn} onPress={onCallRecordTap} activeOpacity={0.7}>
          <Text style={styles.callBtnText}>On a call right now</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.recentScroll} contentContainerStyle={styles.recentContent}>
        {recent.length > 0 && (
          <Text style={styles.sectionLabel}>RECENT</Text>
        )}
        {recent.map(n => (
          <View key={n.id} style={styles.noteCard}>
            <View style={styles.noteCardText}>
              <Text style={styles.noteTitle} numberOfLines={1}>{n.title}</Text>
              <Text style={styles.noteSummary} numberOfLines={2}>{n.summary}</Text>
              <Text style={styles.noteDate}>{formatDate(n.ts)}</Text>
            </View>
            <View style={styles.noteCardActions}>
              <TouchableOpacity style={styles.shareBtn} onPress={() => shareNote(n)} activeOpacity={0.75}>
                <Text style={styles.shareBtnText}>↑</Text>
              </TouchableOpacity>
              <SpeakButton text={`${n.title}. ${n.summary}`} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  toastIcon: { fontSize: 20 },
  toastText: { flex: 1 },
  toastTitle: { fontSize: FONTS.size.md, color: '#fff', fontWeight: '600' },
  toastSub: { fontSize: FONTS.size.xs, color: '#c9c0a8', marginTop: 2 },
  errorBanner: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: '#f3e3da',
    borderRadius: 10,
    padding: 12,
  },
  errorText: { fontSize: FONTS.size.sm, color: '#7a3a22' },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 14,
  },
  tagline: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownMid,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
  micBtn: {
    width: 152,
    height: 152,
    borderRadius: 76,
    backgroundColor: COLORS.brown,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  micIcon: { fontSize: 54 },
  micLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    letterSpacing: 0.3,
  },
  callBtn: {
    marginTop: 2,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  callBtnText: { fontSize: FONTS.size.xs, color: COLORS.brownLight },
  recentScroll: { flex: 0.78 },
  recentContent: { paddingHorizontal: 20, paddingBottom: 16 },
  sectionLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 1.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  noteCardText: { flex: 1 },
  noteCardActions: { flexDirection: 'column', alignItems: 'center', gap: 6 },
  shareBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  shareBtnText: { fontSize: 14, color: COLORS.brownLight, fontWeight: '600' },
  noteTitle: { fontSize: FONTS.size.sm, fontWeight: '600', color: COLORS.brown },
  noteSummary: { fontSize: FONTS.size.xs, color: COLORS.brownLight, marginTop: 2 },
  noteDate: { fontSize: FONTS.size.xs, color: COLORS.brownFaint, marginTop: 4 },
});
