import React, { useState } from 'react';
import {
  Modal,
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
  visible: boolean;
  pending: PendingCapture;
  tree: FolderNode;
  todoLists: TodoList[];
  onApprove: (overrideFolderId?: string) => void;
  onDiscard: () => void;
}

export default function ReviewScreen({
  visible,
  pending,
  tree,
  todoLists,
  onApprove,
  onDiscard,
}: Props) {
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(undefined);
  const allFolders = flattenFolders(tree);
  const isTodo = pending.contentType === 'todo_items';
  const isCalendar = pending.contentType === 'calendar_entries';
  const todoItems = isTodo ? pending.todoItems : [];
  const noteActions = !isTodo && !isCalendar ? pending.actionItems : [];
  const calendarEntries = isCalendar ? pending.calendarEntries : [];
  const hasBodyContent =
    !!pending.title ||
    !!pending.summary ||
    todoItems.length > 0 ||
    noteActions.length > 0 ||
    calendarEntries.length > 0;

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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.modalScrim}>
        <View style={styles.container}>
          <TopBar subtitle="Review" title={isTodo ? 'New to-dos' : isCalendar ? 'New schedule items' : 'New note'} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={styles.hero}>
              <Text style={styles.title}>{pending.title || 'Ready to review'}</Text>
              <Text style={styles.summary}>
                {pending.summary || 'We processed the recording. Review the extracted details below before saving.'}
              </Text>
            </View>

            <View style={styles.titleRow}>
              <SpeakButton text={`${pending.title || ''}. ${pending.summary || ''}`} />
            </View>

            {!isCalendar ? (
              <>
                <Text style={styles.sectionLabel}>{isTodo ? 'TO-DO CATEGORY' : 'NOTE CATEGORY'}</Text>
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>{suggestedLabel}</Text>
                </View>
              </>
            ) : null}

            {isTodo ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 12 }]}>TARGET LIST</Text>
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>{todoListLabel || 'New to-do list'}</Text>
                </View>
              </>
            ) : null}

            {!isCalendar && allFolders.length > 1 ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 12 }]}>CHOOSE CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderScroll}>
                  {allFolders.slice(1).map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.folderChip, selectedFolder === f.id && styles.folderChipActive]}
                      onPress={() => setSelectedFolder(f.id === selectedFolder ? undefined : f.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.folderChipText, selectedFolder === f.id && styles.folderChipTextActive]}
                      >
                        {f.path.slice(1).join(' / ') || f.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}

            {!hasBodyContent ? (
              <View style={styles.previewCard}>
                <Text style={styles.previewText}>No items extracted - try recording again.</Text>
              </View>
            ) : null}

            {isCalendar ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>EVENTS</Text>
                {calendarEntries.length ? (
                  calendarEntries.map((entry, i) => (
                    <View key={i} style={styles.previewRow}>
                      <View style={styles.actionDot} />
                      <View style={styles.actionText}>
                        <Text style={styles.actionItemText}>{entry.title || 'Untitled event'}</Text>
                        <Text style={styles.actionDue}>
                          Date: {entry.date || 'Today'}{'\n'}
                          Time: {entry.time || 'All day'}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewText}>No items extracted - try recording again.</Text>
                  </View>
                )}
              </>
            ) : isTodo ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>TASKS</Text>
                {todoItems.length ? (
                  todoItems.map((item, i) => (
                    <View key={i} style={styles.previewRow}>
                      <View style={styles.actionDot} />
                      <View style={styles.actionText}>
                        <Text style={styles.actionItemText}>{item.text || 'Untitled task'}</Text>
                        <Text style={styles.actionDue}>List: {todoListLabel || 'New to-do list'}</Text>
                        <Text style={styles.actionDue}>Reminder: {item.due || 'None inferred'}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewText}>No items extracted - try recording again.</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>NOTE PREVIEW</Text>
                <View style={styles.previewCard}>
                  <Text style={styles.previewText}>
                    {pending.summary || 'No summary extracted - try recording again.'}
                  </Text>
                </View>
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>ACTION ITEMS</Text>
                {noteActions.length ? (
                  noteActions.map((a, i) => (
                    <View key={i} style={styles.previewRow}>
                      <View style={styles.actionDot} />
                      <View style={styles.actionText}>
                        <Text style={styles.actionItemText}>{a.text || 'Untitled action item'}</Text>
                        <Text style={styles.actionDue}>
                          Due: {a.due || 'No due date inferred'}
                          {a.inferred && a.due ? ' (inferred)' : ''}
                        </Text>
                      </View>
                      <SpeakButton text={a.text} />
                    </View>
                  ))
                ) : (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewText}>No items extracted - try recording again.</Text>
                  </View>
                )}
              </>
            )}

            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>TRANSCRIPT</Text>
            <View style={styles.transcriptRow}>
              <Text style={styles.transcript}>
                {pending.transcript || 'Transcript unavailable for this recording.'}
              </Text>
              <SpeakButton text={pending.transcript || ''} />
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
              <Text style={styles.approveText}>{isTodo ? 'Add tasks' : isCalendar ? 'Add events' : 'Approve'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(45, 36, 29, 0.28)',
    justifyContent: 'flex-end',
    zIndex: 1000,
    elevation: 1000,
  },
  container: {
    maxHeight: '92%',
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    zIndex: 1001,
    elevation: 1001,
  },
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
  previewCard: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: FONTS.size.md,
    color: COLORS.brown,
    fontWeight: '600',
  },
  previewText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownMid,
    lineHeight: 20,
  },
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
  previewRow: {
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
