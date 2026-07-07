import React, { useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import TopBar from '../components/TopBar';
import ActionSheetModal from '../components/ActionSheetModal';
import NamePromptModal from '../components/NamePromptModal';
import SpeakButton from '../components/SpeakButton';
import { COLORS, FONTS } from '../constants';
import { formatDate } from '../utils';
import { FolderNode, Note } from '../types';

interface Props {
  folder: FolderNode;
  notes: Note[];
  onBack: () => void;
  onOpenFolder: (folder: FolderNode) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

export default function FolderDetailScreen({
  folder,
  notes,
  onBack,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const [actionFolder, setActionFolder] = useState<{ id: string; name: string } | null>(null);
  const [renameFolderState, setRenameFolderState] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (renameFolderState) { setRenameFolderState(null); return true; }
      if (actionFolder) { setActionFolder(null); return true; }
      onBack();
      return true;
    });
    return () => handler.remove();
  }, [actionFolder, renameFolderState]);
  const [renameDraft, setRenameDraft] = useState('');
  const folderIds = new Set<string>();
  function collectIds(node: FolderNode) {
    folderIds.add(node.id);
    node.children.forEach(collectIds);
  }
  collectIds(folder);

  const folderNotes = notes.filter(n => folderIds.has(n.folderId));
  const openRename = (folderId: string, name: string) => {
    setRenameFolderState({ id: folderId, name });
    setRenameDraft(name);
    setActionFolder(null);
  };
  const submitRename = () => {
    const trimmed = renameDraft.trim();
    if (!trimmed || !renameFolderState) return;
    onRenameFolder(renameFolderState.id, trimmed);
    setRenameFolderState(null);
    setRenameDraft('');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TopBar subtitle="Notes" title={folder.name} onBack={onBack} />

        <View style={styles.headerActionRow}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => setActionFolder({ id: folder.id, name: folder.name })}
            activeOpacity={0.8}
          >
            <Text style={styles.headerActionText}>Rename or delete category</Text>
          </TouchableOpacity>
        </View>

        {folder.children.length > 0 && (
          <View style={styles.subfolderRow}>
            {folder.children.map(c => (
              <TouchableOpacity
                key={c.id}
                style={styles.subfolderChip}
                onPress={() => onOpenFolder(c)}
                onLongPress={() => setActionFolder({ id: c.id, name: c.name })}
                activeOpacity={0.8}
              >
                <Text style={styles.subfolderText}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {folderNotes.length === 0 ? (
          <Text style={styles.empty}>No notes in this category yet.</Text>
        ) : (
          folderNotes.map(n => (
            <View key={n.id} style={styles.noteCard}>
              <View style={styles.noteCardMain}>
                <View style={styles.noteCardText}>
                  <Text style={styles.noteTitle}>{n.title}</Text>
                  <Text style={styles.noteSummary}>{n.summary}</Text>
                  <Text style={styles.noteDate}>{formatDate(n.ts)}</Text>
                  {n.actionItems.filter(a => !a.done).length > 0 && (
                    <View style={styles.actionPills}>
                      {n.actionItems.filter(a => !a.done).map((a, i) => (
                        <View key={i} style={styles.actionPill}>
                          <Text style={styles.actionPillText} numberOfLines={1}>
                            {a.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() => Share.share({ title: n.title, message: `${n.title}\n\n${n.summary}` })}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.shareBtnText}>↑</Text>
                  </TouchableOpacity>
                  <SpeakButton text={`${n.title}. ${n.summary}`} />
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ActionSheetModal
        visible={!!actionFolder}
        title={actionFolder?.name || 'Category'}
        message="Choose an action"
        options={[
          { label: 'Rename', onPress: () => actionFolder && openRename(actionFolder.id, actionFolder.name) },
          {
            label: 'Delete',
            destructive: true,
            onPress: () => {
              if (!actionFolder) return;
              const folderId = actionFolder.id;
              const targetName = actionFolder.name;
              const targetNode = actionFolder.id === folder.id
                ? folder
                : folder.children.find(child => child.id === actionFolder.id) || null;
              const noteCount = targetNode
                ? notes.filter(note => {
                    const ids = new Set<string>();
                    const visit = (node: FolderNode) => {
                      ids.add(node.id);
                      node.children.forEach(visit);
                    };
                    visit(targetNode);
                    return ids.has(note.folderId);
                  }).length
                : 0;
              setActionFolder(null);
              Alert.alert(
                'Delete this category?',
                noteCount
                  ? `This folder contains ${noteCount} note${noteCount === 1 ? '' : 's'}. Deleting it will move them to Miscellaneous.`
                  : `Delete "${targetName}"?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onDeleteFolder(folderId) },
                ]
              );
            },
          },
        ]}
        onCancel={() => setActionFolder(null)}
      />

      <NamePromptModal
        visible={!!renameFolderState}
        title="Rename category"
        placeholder="Category name"
        value={renameDraft}
        onChangeText={setRenameDraft}
        onConfirm={submitRename}
        onCancel={() => {
          setRenameFolderState(null);
          setRenameDraft('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  headerActionRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerActionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.cream,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerActionText: {
    fontSize: FONTS.size.xs,
    color: COLORS.brown,
    fontWeight: '600',
  },
  subfolderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  subfolderChip: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subfolderText: { fontSize: FONTS.size.xs, color: COLORS.brownMid },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  empty: {
    fontSize: FONTS.size.md,
    color: COLORS.brownFaint,
    textAlign: 'center',
    marginTop: 48,
  },
  noteCard: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  noteCardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteCardText: { flex: 1 },
  cardActions: { flexDirection: 'column', alignItems: 'center', gap: 6 },
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
  noteTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.brown,
    marginBottom: 3,
  },
  noteSummary: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    lineHeight: 17,
  },
  noteDate: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    marginTop: 4,
  },
  actionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  actionPill: {
    backgroundColor: COLORS.bgAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 180,
  },
  actionPillText: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownMid,
  },
});
