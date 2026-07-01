import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import TopBar from '../components/TopBar';
import SpeakButton from '../components/SpeakButton';
import { COLORS, FONTS } from '../constants';
import { flattenFolders, folderPathLabel } from '../utils';
import { FolderNode, Note, PendingNote } from '../types';

interface Props {
  pending: PendingNote;
  tree: FolderNode;
  notes: Note[];
  onApprove: (overrideFolderId?: string) => void;
  onDiscard: () => void;
}

export default function ReviewScreen({
  pending,
  tree,
  onApprove,
  onDiscard,
}: Props) {
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(undefined);
  const allFolders = flattenFolders(tree);

  const suggestedLabel = pending.existingFolderId
    ? folderPathLabel(pending.existingFolderId, allFolders)
    : pending.newFolderSuggestion
    ? `New: ${folderPathLabel(pending.newFolderSuggestion.parentId, allFolders)} / ${pending.newFolderSuggestion.name}`
    : 'Miscellaneous';

  return (
    <View style={styles.container}>
      <TopBar subtitle="Review" title="New note" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{pending.title}</Text>
          <SpeakButton text={`${pending.title}. ${pending.summary}`} />
        </View>
        <Text style={styles.summary}>{pending.summary}</Text>

        <Text style={styles.sectionLabel}>FILED UNDER</Text>
        <View style={styles.folderPill}>
          <Text style={styles.folderPillText}>📁  {suggestedLabel}</Text>
        </View>

        {allFolders.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>FILE ELSEWHERE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderScroll}>
              {allFolders.slice(1).map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.folderChip,
                    selectedFolder === f.id && styles.folderChipActive,
                  ]}
                  onPress={() => setSelectedFolder(f.id === selectedFolder ? undefined : f.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.folderChipText,
                    selectedFolder === f.id && styles.folderChipTextActive,
                  ]}>
                    {f.path.slice(1).join(' / ') || f.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {pending.actionItems.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>ACTION ITEMS</Text>
            {pending.actionItems.map((a, i) => (
              <View key={i} style={styles.actionItem}>
                <View style={styles.actionDot} />
                <View style={styles.actionText}>
                  <Text style={styles.actionItemText}>{a.text}</Text>
                  {a.due && (
                    <Text style={styles.actionDue}>
                      ⏰ {a.due}{a.inferred ? '  · guessed' : ''}
                    </Text>
                  )}
                </View>
                <SpeakButton text={a.text} />
              </View>
            ))}
          </>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>TRANSCRIPT</Text>
        <View style={styles.transcriptRow}>
          <Text style={styles.transcript}>{pending.transcript}</Text>
          <SpeakButton text={pending.transcript} />
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.discardBtn} onPress={onDiscard} activeOpacity={0.7}>
          <Text style={styles.discardText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.approveBtn}
          onPress={() => onApprove(selectedFolder)}
          activeOpacity={0.8}
        >
          <Text style={styles.approveText}>✓  Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: FONTS.size.xl,
    fontWeight: '600',
    color: COLORS.brown,
  },
  summary: {
    fontSize: FONTS.size.md,
    color: COLORS.brownMid,
    lineHeight: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  folderPill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.cream,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
  },
  folderPillText: { fontSize: FONTS.size.md, color: COLORS.brown },
  folderScroll: { marginBottom: 4 },
  folderChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  folderChipActive: { backgroundColor: COLORS.cream, borderColor: COLORS.cream },
  folderChipText: { fontSize: FONTS.size.xs, color: COLORS.brownMid },
  folderChipTextActive: { color: COLORS.brown, fontWeight: '600' },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    gap: 8,
  },
  actionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.red,
    marginTop: 5,
  },
  actionText: { flex: 1 },
  actionItemText: { fontSize: FONTS.size.md, color: COLORS.brown },
  actionDue: { fontSize: FONTS.size.xs, color: COLORS.brownLight, marginTop: 3 },
  transcriptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.white60,
    borderRadius: 8,
    padding: 12,
  },
  transcript: {
    flex: 1,
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  discardBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  discardText: { fontSize: FONTS.size.md, color: COLORS.brownLight },
  approveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: COLORS.brown,
  },
  approveText: { fontSize: FONTS.size.md, color: '#f6f1e3', fontWeight: '600' },
});
