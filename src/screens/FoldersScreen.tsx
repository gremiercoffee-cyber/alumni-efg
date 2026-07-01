import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import TopBar from '../components/TopBar';
import { COLORS, FONTS } from '../constants';
import { countNotes } from '../utils';
import { FolderNode, Note } from '../types';

interface Props {
  tree: FolderNode;
  notes: Note[];
  onOpenFolder: (folder: FolderNode) => void;
}

function FolderRow({
  folder,
  notes,
  depth,
  onOpenFolder,
}: {
  folder: FolderNode;
  notes: Note[];
  depth: number;
  onOpenFolder: (f: FolderNode) => void;
}) {
  const notesByFolder: Record<string, number> = {};
  notes.forEach(n => {
    notesByFolder[n.folderId] = (notesByFolder[n.folderId] || 0) + 1;
  });
  const total = countNotes(folder, notesByFolder);

  return (
    <>
      <TouchableOpacity
        style={[styles.row, { paddingLeft: 20 + depth * 16 }]}
        onPress={() => onOpenFolder(folder)}
        activeOpacity={0.7}
      >
        <Text style={styles.rowIcon}>📁</Text>
        <Text style={styles.rowName}>{folder.name}</Text>
        {total > 0 && <Text style={styles.rowCount}>{total}</Text>}
        <Text style={styles.rowChevron}>›</Text>
      </TouchableOpacity>
      {folder.children.map(child => (
        <FolderRow
          key={child.id}
          folder={child}
          notes={notes}
          depth={depth + 1}
          onOpenFolder={onOpenFolder}
        />
      ))}
    </>
  );
}

export default function FoldersScreen({ tree, notes, onOpenFolder }: Props) {
  return (
    <View style={styles.container}>
      <TopBar subtitle="Browse" title="Folders" />
      <ScrollView contentContainerStyle={styles.content}>
        {tree.children.map(folder => (
          <FolderRow
            key={folder.id}
            folder={folder}
            notes={notes}
            depth={0}
            onOpenFolder={onOpenFolder}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 8,
  },
  rowIcon: { fontSize: 16 },
  rowName: { flex: 1, fontSize: FONTS.size.md, color: COLORS.brown },
  rowCount: { fontSize: FONTS.size.xs, color: COLORS.brownFaint },
  rowChevron: { fontSize: 20, color: COLORS.brownFaint, lineHeight: 22 },
});
