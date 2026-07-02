import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
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
  onAddFolder: (name: string) => void;
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

export default function FoldersScreen({ tree, notes, onOpenFolder, onAddFolder }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const submitFolder = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      onAddFolder(trimmed);
    }
    setNameInput('');
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <TopBar subtitle="Browse" title="Folders" />

      {tree.children.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.empty}>
            No folders yet. They&apos;ll appear here as you record notes, or you can create one now.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Create folder</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>New folder</Text>
            </TouchableOpacity>
          </View>

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
        </>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New folder</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Folder name"
              placeholderTextColor={COLORS.brownFaint}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setNameInput('');
                  setModalVisible(false);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCreate} onPress={submitFolder}>
                <Text style={styles.modalCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  content: { paddingVertical: 8, paddingBottom: 90 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
    gap: 18,
  },
  empty: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownFaint,
    textAlign: 'center',
    lineHeight: 21,
  },
  primaryBtn: {
    minWidth: 170,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brown,
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  primaryBtnText: {
    fontSize: FONTS.size.md,
    color: COLORS.bg,
    fontWeight: '600',
  },
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
  rowName: { flex: 1, fontSize: FONTS.size.sm, color: COLORS.brown },
  rowCount: { fontSize: FONTS.size.xs, color: COLORS.brownFaint },
  rowChevron: { fontSize: 20, color: COLORS.brownFaint, lineHeight: 22 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.brown,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  fabIcon: { fontSize: 26, color: COLORS.bg, marginTop: -2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    width: '80%',
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: '600',
    color: COLORS.brown,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: FONTS.size.md,
    color: COLORS.brown,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: { paddingVertical: 8, paddingHorizontal: 12 },
  modalCancelText: { fontSize: FONTS.size.md, color: COLORS.brownFaint },
  modalCreate: {
    backgroundColor: COLORS.brown,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  modalCreateText: { fontSize: FONTS.size.md, color: COLORS.bg, fontWeight: '600' },
});
