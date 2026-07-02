import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import TopBar from '../components/TopBar';
import { COLORS, FONTS } from '../constants';
import { countNotes, formatReminderLabel } from '../utils';
import { FolderNode, TodoList } from '../types';

interface Props {
  tree: FolderNode;
  todoLists: TodoList[];
  focusedFolderId?: string | null;
  focusedListId?: string | null;
  onToggle: (listId: string, itemId: string) => void;
  onAddItem: (listId: string, text: string) => void;
  onEditReminder: (listId: string, itemId: string) => void;
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

function TodoListCard({
  list,
  focused,
  onToggle,
  onAddItem,
  onEditReminder,
  completedExpanded,
  onToggleCompletedExpanded,
}: {
  list: TodoList;
  focused: boolean;
  onToggle: (listId: string, itemId: string) => void;
  onAddItem: (listId: string, text: string) => void;
  onEditReminder: (listId: string, itemId: string) => void;
  completedExpanded: boolean;
  onToggleCompletedExpanded: () => void;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput | null>(null);
  const activeItems = list.items.filter(item => !item.done);
  const completedItems = list.items.filter(item => item.done);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAddItem(list.id, trimmed);
    setDraft('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <View style={[styles.list, focused && styles.listFocused]}>
      <Text style={styles.listTitle}>{list.title}</Text>

      {activeItems.length === 0 ? (
        <Text style={styles.emptyList}>No open items. Add one below.</Text>
      ) : (
        activeItems.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.itemRow}
            onPress={() => onToggle(list.id, item.id)}
            activeOpacity={0.75}
          >
            <View style={styles.checkbox} />
            <View style={styles.itemTextWrap}>
              <Text style={styles.itemText}>{item.text}</Text>
              {(item.reminderAt || item.due) ? (
                <TouchableOpacity
                  style={styles.reminderPill}
                  onPress={() => onEditReminder(list.id, item.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.reminderText}>
                    {formatReminderLabel(item.reminderAt) || item.due}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => onEditReminder(list.id, item.id)} activeOpacity={0.8}>
                  <Text style={styles.addReminderText}>Add reminder</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ))
      )}

      <View style={styles.manualEntry}>
        <TextInput
          ref={inputRef}
          style={styles.manualInput}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          placeholder="Add an item"
          placeholderTextColor={COLORS.brownFaint}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={submit} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {completedItems.length > 0 ? (
        <View style={styles.completedWrap}>
          <TouchableOpacity
            style={styles.completedHeader}
            onPress={onToggleCompletedExpanded}
            activeOpacity={0.8}
          >
            <Text style={styles.completedHeaderText}>
              {completedExpanded ? 'Hide' : 'Show'} Completed ({completedItems.length})
            </Text>
          </TouchableOpacity>
          {completedExpanded
            ? completedItems.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemRow}
                  onPress={() => onToggle(list.id, item.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.checkbox, styles.checkboxDone]}>
                    <Text style={styles.checkmark}>x</Text>
                  </View>
                  <View style={styles.itemTextWrap}>
                    <Text style={[styles.itemText, styles.itemDone]}>{item.text}</Text>
                    <Text style={styles.restoreText}>Tap to move back to active</Text>
                  </View>
                </TouchableOpacity>
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

export default function ToDosScreen({
  tree,
  todoLists,
  focusedFolderId = null,
  focusedListId = null,
  onToggle,
  onAddItem,
  onEditReminder,
}: Props) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(focusedFolderId);
  const [expandedCompleted, setExpandedCompleted] = useState<Record<string, boolean>>({});
  const selectedFolder = selectedFolderId ? findFolder(tree, selectedFolderId) : null;
  const selectedIds = selectedFolder ? collectFolderIds(selectedFolder) : null;
  const activeLists = selectedFolderId
    ? todoLists.filter(list => selectedIds?.has(list.folderId))
    : todoLists;
  const open = openItemCount(todoLists);

  useEffect(() => {
    if (focusedFolderId) {
      setSelectedFolderId(focusedFolderId);
    }
  }, [focusedFolderId]);

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
            <TodoListCard
              key={list.id}
              list={list}
              focused={focusedListId === list.id}
              onToggle={onToggle}
              onAddItem={onAddItem}
              onEditReminder={onEditReminder}
              completedExpanded={!!expandedCompleted[list.id]}
              onToggleCompletedExpanded={() =>
                setExpandedCompleted(current => ({
                  ...current,
                  [list.id]: !current[list.id],
                }))
              }
            />
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
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderRadius: 12,
    padding: 12,
  },
  listFocused: {
    borderWidth: 1,
    borderColor: COLORS.brown,
  },
  listTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '700',
    color: COLORS.brown,
    marginBottom: 8,
  },
  emptyList: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownFaint,
    marginBottom: 10,
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
  reminderPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: COLORS.cream,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reminderText: {
    fontSize: FONTS.size.xs,
    color: COLORS.brown,
  },
  addReminderText: {
    fontSize: FONTS.size.xs,
    color: COLORS.red,
    marginTop: 6,
  },
  manualEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  manualInput: {
    flex: 1,
    backgroundColor: COLORS.white60,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FONTS.size.md,
    color: COLORS.brown,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.brown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: COLORS.bg,
    fontSize: 24,
    lineHeight: 24,
  },
  completedWrap: {
    marginTop: 10,
  },
  completedHeader: {
    paddingVertical: 8,
  },
  completedHeaderText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownLight,
    fontWeight: '600',
  },
  restoreText: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    marginTop: 4,
  },
});
