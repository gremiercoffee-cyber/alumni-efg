import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

function FolderRow({
  folder,
  notes,
  depth,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  folder: FolderNode;
  notes: Note[];
  depth: number;
  onOpenFolder: (f: FolderNode) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
}) {
  const notesByFolder: Record<string, number> = {};
  notes.forEach(n => {
    notesByFolder[n.folderId] = (notesByFolder[n.folderId] || 0) + 1;
  });
  const total = countNotes(folder, notesByFolder);

  const showActions = () => {
    Alert.alert(folder.name, 'Choose an action', [
      { text: 'Rename', onPress: () => onRenameFolder(folder.id, folder.name) },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteFolder(folder.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.row, { paddingLeft: 20 + depth * 16 }]}
        onPress={() => onOpenFolder(folder)}
        onLongPress={showActions}
        delayLongPress={220}
        activeOpacity={0.7}
      >
        <Text style={styles.rowIcon}>Folder</Text>
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
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
        />
      ))}
    </>
  );
}

export default function FoldersScreen({
  tree,
  notes,
  onOpenFolder,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null);

  const submitFolder = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    if (editingFolder) {
      onRenameFolder(editingFolder.id, trimmed);
    } else {
      onAddFolder(trimmed);
    }

    setNameInput('');
    setEditingFolder(null);
    setModalVisible(false);
  };

  const openRenameModal = (folderId: string, name: string) => {
    setEditingFolder({ id: folderId, name });
    setNameInput(name);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <TopBar subtitle="Browse" title="Notes" />

      {tree.children.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.empty}>
            No notes yet. They'll appear here as you record notes, or you can create a category now.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              setEditingFolder(null);
              setNameInput('');
              setModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Create category</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                setEditingFolder(null);
                setNameInput('');
                setModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>New category</Text>
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
                onRenameFolder={openRenameModal}
                onDeleteFolder={onDeleteFolder}
              />
            ))}
          </ScrollView>
        </>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setEditingFolder(null);
          setNameInput('');
          setModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingFolder ? 'Rename category' : 'New category'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Category name"
              placeholderTextColor={COLORS.brownFaint}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              onSubmitEditing={submitFolder}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setNameInput('');
                  setEditingFolder(null);
                  setModalVisible(false);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCreate} onPress={submitFolder}>
                <Text style={styles.modalCreateText}>
                  {editingFolder ? 'Save' : 'Create'}
                </Text>
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
  rowIcon: { fontSize: FONTS.size.xs, color: COLORS.brownLight, width: 38 },
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
