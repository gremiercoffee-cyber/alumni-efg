import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import TopBar from '../components/TopBar';
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
  const folderIds = new Set<string>();
  function collectIds(node: FolderNode) {
    folderIds.add(node.id);
    node.children.forEach(collectIds);
  }
  collectIds(folder);

  const folderNotes = notes.filter(n => folderIds.has(n.folderId));

  const showActions = () => {
    Alert.alert(folder.name, 'Choose an action', [
      { text: 'Rename', onPress: () => onRenameFolder(folder.id, folder.name) },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteFolder(folder.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <TopBar subtitle="Notes" title={folder.name} onBack={onBack} />

      <View style={styles.headerActionRow}>
        <TouchableOpacity style={styles.headerActionBtn} onPress={showActions} activeOpacity={0.8}>
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
              onLongPress={() =>
                Alert.alert(c.name, 'Choose an action', [
                  { text: 'Rename', onPress: () => onRenameFolder(c.id, c.name) },
                  { text: 'Delete', style: 'destructive', onPress: () => onDeleteFolder(c.id) },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
              activeOpacity={0.8}
            >
              <Text style={styles.subfolderText}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
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
                <SpeakButton text={`${n.title}. ${n.summary}`} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  content: { padding: 16 },
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
