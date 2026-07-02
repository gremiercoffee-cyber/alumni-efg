import React, { useState } from 'react';
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
import { FolderNode, TodoList } from '../types';

interface Props {
  tree: FolderNode;
  todoLists: TodoList[];
  onToggle: (listId: string, itemId: string) => void;
}

function openItemCount(lists: TodoList[]): number {
  return lists.reduce((sum, list) => sum + list.items.filter(item => !item.done).length, 0);
}

function collectFolderIds(node: FolderNode, ids = new Set<string>()): Set<string> {
  ids.add(node.id);
  node.children.forEach(child => collectFolderIds(child, ids));
  return ids;
}

function findFolder(node: FolderNode, id: string): FolderNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findFolder(child, id);
    if (found) return found;
  }
  return null;
}

function FolderTodoRow({
  folder,
  todoLists,
  depth,
  selectedFolderId,
  onSelect,
}: {
  folder: FolderNode;
  todoLists: TodoList[];
  depth: number;
  selectedFolderId: string | null;
  onSelect: (folderId: string) => void;
}) {
  const counts: Record<string, number> = {};
  todoLists.forEach(list => {
    counts[list.folderId] = (counts[list.folderId] || 0) + list.items.filter(item => !item.done).length;
  });
  const total = countNotes(folder, counts);
  const active = selectedFolderId === folder.id;

  return (
    <>
      <TouchableOpacity
        style={[styles.folderRow, active && styles.folderRowActive, { paddingLeft: 20 + depth * 16 }]}
        onPress={() => onSelect(folder.id)}
        activeOpacity={0.75}
      >
        <Text style={styles.folderName}>{folder.name}</Text>
        {total > 0 && <Text style={styles.folderCount}>{total}</Text>}
      </TouchableOpacity>
      {folder.children.map(child => (
        <FolderTodoRow
          key={child.id}
          folder={child}
          todoLists={todoLists}
          depth={depth + 1}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export default function ToDosScreen({ tree, todoLists, onToggle }: Props) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const selectedFolder = selectedFolderId ? findFolder(tree, selectedFolderId) : null;
  const selectedIds = selectedFolder ? collectFolderIds(selectedFolder) : null;
  const activeLists = selectedFolderId
    ? todoLists.filter(list => selectedIds?.has(list.folderId))
    : todoLists;
  const open = openItemCount(todoLists);

  return (
    <View style={styles.container}>
      <TopBar subtitle={`${open} open`} title="To-Dos" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroCount}>{open}</Text>
          <Text style={styles.heroLabel}>{open === 1 ? 'Open task' : 'Open tasks'}</Text>
        </View>

        {tree.children.length > 0 && (
          <View style={styles.folderList}>
            <TouchableOpacity
              style={[styles.folderRow, selectedFolderId === null && styles.folderRowActive]}
              onPress={() => setSelectedFolderId(null)}
              activeOpacity={0.75}
            >
              <Text style={styles.folderName}>All to-dos</Text>
              {open > 0 && <Text style={styles.folderCount}>{open}</Text>}
            </TouchableOpacity>
            {tree.children.map(folder => (
              <FolderTodoRow
                key={folder.id}
                folder={folder}
                todoLists={todoLists}
                depth={0}
                selectedFolderId={selectedFolderId}
                onSelect={setSelectedFolderId}
              />
            ))}
          </View>
        )}

        {activeLists.length === 0 ? (
          <Text style={styles.empty}>
            To-do lists will appear here when you speak a clear list of tasks into the Home mic.
          </Text>
        ) : (
          activeLists.map(list => (
            <View key={list.id} style={styles.list}>
              <Text style={styles.listTitle}>{list.title}</Text>
              {list.items.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemRow}
                  onPress={() => onToggle(list.id, item.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
                    {item.done && <Text style={styles.checkmark}>x</Text>}
                  </View>
                  <View style={styles.itemTextWrap}>
                    <Text style={[styles.itemText, item.done && styles.itemDone]}>{item.text}</Text>
                    {item.due && <Text style={styles.itemDue}>{item.due}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 12, paddingBottom: 28 },
  hero: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 18,
  },
  heroCount: {
    fontSize: 54,
    fontWeight: '700',
    color: COLORS.brown,
    lineHeight: 58,
  },
  heroLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  folderList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    marginBottom: 16,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 8,
  },
  folderRowActive: {
    backgroundColor: COLORS.white50,
  },
  folderName: {
    flex: 1,
    fontSize: FONTS.size.sm,
    color: COLORS.brown,
  },
  folderCount: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
  },
  empty: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownFaint,
    textAlign: 'center',
    marginTop: 28,
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  list: {
    marginBottom: 18,
  },
  listTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '700',
    color: COLORS.brown,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.brownLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxDone: {
    backgroundColor: COLORS.brown,
    borderColor: COLORS.brown,
  },
  checkmark: { fontSize: 11, color: '#fff' },
  itemTextWrap: { flex: 1 },
  itemText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brown,
  },
  itemDone: {
    textDecorationLine: 'line-through',
    color: COLORS.brownFaint,
  },
  itemDue: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    marginTop: 3,
  },
});
