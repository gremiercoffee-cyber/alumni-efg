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
import { FolderNode, PendingCapture, TodoList } from '../types';

interface Props {
  pending: PendingCapture;
  tree: FolderNode;
  todoLists: TodoList[];
  onApprove: (overrideFolderId?: string) => void;
  onDiscard: () => void;
}

export default function ReviewScreen({
  pending,
  tree,
  todoLists,
  onApprove,
  onDiscard,
}: Props) {
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(undefined);
  const allFolders = flattenFolders(tree);
  const isTodo = pending.contentType === 'todo_items';

  const suggestedLabel = pending.existingFolderId
    ? folderPathLabel(pending.existingFolderId, allFolders)
    : pending.newFolderSuggestion
    ? `New: ${folderPathLabel(pending.newFolderSuggestion.parentId, allFolders)} / ${pending.newFolderSuggestion.name}`
    : 'Everything';

  const todoListLabel = isTodo
    ? pending.existingTodoListId
      ? todoLists.find(list => list.id === pending.existingTodoListId)?.title || 'Existing list'
      : pending.newTodoListTitle || pending.title
    : null;

  return (
    <View style={styles.container}>
      <TopBar subtitle="Review" title={isTodo ? 'New to-dos' : 'New note'} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>{pending.title}</Text>
          <Text style={styles.summary}>{pending.summary}</Text>
        </View>

        <View style={styles.titleRow}>
          <SpeakButton text={`${pending.title}. ${pending.summary}`} />
        </View>

        <Text style={styles.sectionLabel}>{isTodo ? 'TO-DO FOLDER' : 'FILED UNDER'}</Text>
        <View style={styles.folderPill}>
          <Text style={styles.folderPillText}>{suggestedLabel}</Text>
        </View>

        {isTodo && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>RUNNING LIST</Text>
            <View style={styles.folderPill}>
              <Text style={styles.folderPillText}>{todoListLabel}</Text>
            </View>
          </>
        )}

        {allFolders.length > 1 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>CHOOSE FOLDER</Text>
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
                  <Text
                    style={[
                      styles.folderChipText,
                      selectedFolder === f.id && styles.folderChipTextActive,
                    ]}
                  >
                    {f.path.slice(1).join(' / ') || f.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {isTodo ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>TASKS</Text>
            {pending.todoItems.map((item, i) => (
              <View key={i} style={styles.actionItem}>
                <View style={styles.actionDot} />
                <View style={styles.actionText}>
                  <Text style={styles.actionItemText}>{item.text}</Text>
                  {item.due && <Text style={styles.actionDue}>{item.due}</Text>}
                </View>
              </View>
            ))}
          </>
        ) : (
          pending.actionItems.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>ACTION ITEMS</Text>
              {pending.actionItems.map((a, i) => (
                <View key={i} style={styles.actionItem}>
                  <View style={styles.actionDot} />
                  <View style={styles.actionText}>
                    <Text style={styles.actionItemText}>{a.text}</Text>
                    {a.due && (
                      <Text style={styles.actionDue}>
                        {a.due}{a.inferred ? ' - guessed' : ''}
                      </Text>
                    )}
                  </View>
                  <SpeakButton text={a.text} />
                </View>
              ))}
            </>
          )
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
          <Text style={styles.approveText}>{isTodo ? 'Add tasks' : 'Approve'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 8 },
  hero: {
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.brown,
    textAlign: 'center',
  },
  summary: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownMid,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 320,
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
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  discardText: { fontSize: FONTS.size.md, color: COLORS.brownLight },
  approveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 30,
    backgroundColor: COLORS.brown,
  },
  approveText: { fontSize: FONTS.size.lg, color: '#f6f1e3', fontWeight: '700' },
});
