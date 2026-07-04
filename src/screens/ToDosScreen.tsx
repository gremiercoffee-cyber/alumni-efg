import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import TopBar from '../components/TopBar';
import { COLORS, FONTS } from '../constants';
import { formatReminderLabel } from '../utils';
import { FolderNode, TodoItem, TodoList } from '../types';

interface Props {
  tree: FolderNode;
  todoLists: TodoList[];
  focusedFolderId?: string | null;
  focusedListId?: string | null;
  onToggle: (listId: string, itemId: string) => void;
  onAddItem: (listId: string, text: string) => void;
  onEditReminder: (listId: string, itemId: string) => void;
  onRenameList: (listId: string, title: string) => void;
  onEditItem: (listId: string, itemId: string, text: string) => void | Promise<void>;
  onDeleteItem: (listId: string, itemId: string) => void | Promise<void>;
  onOpenSourceNote: (noteId: string) => void;
}

function collectFolderIds(node: FolderNode, ids = new Set<string>()): Set<string> {
  ids.add(node.id);
  node.children.forEach(child => collectFolderIds(child, ids));
  return ids;
}

function countOpenItems(lists: TodoList[]): number {
  return lists.reduce((sum, list) => sum + list.items.filter(item => !item.done).length, 0);
}

function TodoRow({
  item,
  listId,
  editing,
  editDraft,
  onChangeDraft,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggle,
  onEditReminder,
  onDeleteItem,
  onOpenSourceNote,
  helperText,
}: {
  item: TodoItem;
  listId: string;
  editing: boolean;
  editDraft: string;
  onChangeDraft: (value: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggle: (listId: string, itemId: string) => void;
  onEditReminder: (listId: string, itemId: string) => void;
  onDeleteItem: (listId: string, itemId: string) => void | Promise<void>;
  onOpenSourceNote: (noteId: string) => void;
  helperText?: string;
}) {
  return (
    <View style={styles.itemRow}>
      <TouchableOpacity
        style={[styles.checkbox, item.done && styles.checkboxDone]}
        onPress={() => onToggle(listId, item.id)}
        activeOpacity={0.75}
      >
        {item.done && <Text style={styles.checkmark}>x</Text>}
      </TouchableOpacity>

      <View style={styles.itemTextWrap}>
        {editing ? (
          <TextInput
            style={styles.inlineEditInput}
            value={editDraft}
            onChangeText={onChangeDraft}
            autoFocus
            onSubmitEditing={onSaveEdit}
            onBlur={onSaveEdit}
            returnKeyType="done"
          />
        ) : (
          <TouchableOpacity onPress={onStartEdit} activeOpacity={0.8}>
            <Text style={[styles.itemText, item.done && styles.itemDone]}>{item.text}</Text>
          </TouchableOpacity>
        )}

        {(item.reminderAt || item.due) ? (
          <TouchableOpacity
            style={styles.reminderPill}
            onPress={() => onEditReminder(listId, item.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.reminderText}>
              {formatReminderLabel(item.reminderAt) || item.due}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => onEditReminder(listId, item.id)} activeOpacity={0.8}>
            <Text style={styles.addReminderText}>Add reminder</Text>
          </TouchableOpacity>
        )}

        {item.fromNote ? (
          <TouchableOpacity
            style={styles.sourcePill}
            onPress={() => onOpenSourceNote(item.fromNote!.noteId)}
            activeOpacity={0.82}
          >
            <Text style={styles.sourcePillText}>From note: {item.fromNote.noteTitle}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.rowActions}>
          <TouchableOpacity onPress={() => onEditReminder(listId, item.id)} activeOpacity={0.8}>
            <Text style={styles.rowActionText}>Reminder</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Delete this item?', item.text, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDeleteItem(listId, item.id) },
              ])
            }
            activeOpacity={0.8}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
          {editing ? (
            <TouchableOpacity onPress={onCancelEdit} activeOpacity={0.8}>
              <Text style={styles.rowActionText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {helperText ? <Text style={styles.restoreText}>{helperText}</Text> : null}
      </View>
    </View>
  );
}

function TodoListSection({
  list,
  focused,
  expanded,
  onToggleExpanded,
  onToggle,
  onAddItem,
  onEditReminder,
  onRenameList,
  onEditItem,
  onDeleteItem,
  onOpenSourceNote,
  completedExpanded,
  onToggleCompletedExpanded,
}: {
  list: TodoList;
  focused: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggle: (listId: string, itemId: string) => void;
  onAddItem: (listId: string, text: string) => void;
  onEditReminder: (listId: string, itemId: string) => void;
  onRenameList: (listId: string, title: string) => void;
  onEditItem: (listId: string, itemId: string, text: string) => void | Promise<void>;
  onDeleteItem: (listId: string, itemId: string) => void | Promise<void>;
  onOpenSourceNote: (noteId: string) => void;
  completedExpanded: boolean;
  onToggleCompletedExpanded: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingListTitle, setEditingListTitle] = useState(false);
  const [listTitleDraft, setListTitleDraft] = useState(list.title);
  const inputRef = useRef<TextInput | null>(null);
  const activeItems = list.items.filter(item => !item.done);
  const completedItems = list.items.filter(item => item.done);

  useEffect(() => {
    setListTitleDraft(list.title);
  }, [list.title]);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAddItem(list.id, trimmed);
    setDraft('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const startItemEdit = (item: TodoItem) => {
    setEditingItemId(item.id);
    setEditingText(item.text);
  };

  const saveItemEdit = async () => {
    const trimmed = editingText.trim();
    if (!editingItemId) return;
    if (!trimmed) {
      setEditingItemId(null);
      setEditingText('');
      return;
    }
    await onEditItem(list.id, editingItemId, trimmed);
    setEditingItemId(null);
    setEditingText('');
  };

  const cancelItemEdit = () => {
    setEditingItemId(null);
    setEditingText('');
  };

  const saveListTitle = () => {
    const trimmed = listTitleDraft.trim();
    if (!trimmed) {
      setEditingListTitle(false);
      setListTitleDraft(list.title);
      return;
    }
    onRenameList(list.id, trimmed);
    setEditingListTitle(false);
  };

  return (
    <View style={[styles.listCard, focused && styles.listFocused]}>
      <TouchableOpacity
        style={styles.listHeader}
        onPress={onToggleExpanded}
        activeOpacity={0.85}
      >
        <View style={styles.listHeaderTextWrap}>
          {editingListTitle ? (
            <TextInput
              style={styles.listTitleInput}
              value={listTitleDraft}
              onChangeText={setListTitleDraft}
              autoFocus
              onSubmitEditing={saveListTitle}
              onBlur={saveListTitle}
              returnKeyType="done"
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingListTitle(true)} activeOpacity={0.8}>
              <Text style={styles.listTitle}>{list.title}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.listMeta}>
            {activeItems.length} open{completedItems.length ? ` · ${completedItems.length} done` : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.listBody}>
          {activeItems.length === 0 ? (
            <Text style={styles.emptyList}>No open items. Add one below.</Text>
          ) : (
            activeItems.map(item => (
              <TodoRow
                key={item.id}
                item={item}
                listId={list.id}
                editing={editingItemId === item.id}
                editDraft={editingText}
                onChangeDraft={setEditingText}
                onStartEdit={() => startItemEdit(item)}
                onSaveEdit={saveItemEdit}
                onCancelEdit={cancelItemEdit}
                onToggle={onToggle}
                onEditReminder={onEditReminder}
                onDeleteItem={onDeleteItem}
                onOpenSourceNote={onOpenSourceNote}
              />
            ))
          )}

          <View style={styles.manualEntry}>
            <TextInput
              ref={inputRef}
              style={styles.manualInput}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              placeholder="Add an item…"
              placeholderTextColor={COLORS.brownFaint}
              returnKeyType="done"
              blurOnSubmit={false}
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
                    <TodoRow
                      key={item.id}
                      item={item}
                      listId={list.id}
                      editing={editingItemId === item.id}
                      editDraft={editingText}
                      onChangeDraft={setEditingText}
                      onStartEdit={() => startItemEdit(item)}
                      onSaveEdit={saveItemEdit}
                      onCancelEdit={cancelItemEdit}
                      onToggle={onToggle}
                      onEditReminder={onEditReminder}
                      onDeleteItem={onDeleteItem}
                      onOpenSourceNote={onOpenSourceNote}
                      helperText="Tap the checkbox to move it back to active"
                    />
                  ))
                : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function FolderSection({
  folder,
  todoLists,
  focusedFolderId,
  focusedListId,
  expandedFolders,
  expandedLists,
  expandedCompleted,
  setExpandedFolders,
  setExpandedLists,
  setExpandedCompleted,
  onToggle,
  onAddItem,
  onEditReminder,
  onRenameList,
  onEditItem,
  onDeleteItem,
  onOpenSourceNote,
}: {
  folder: FolderNode;
  todoLists: TodoList[];
  focusedFolderId: string | null;
  focusedListId: string | null;
  expandedFolders: Record<string, boolean>;
  expandedLists: Record<string, boolean>;
  expandedCompleted: Record<string, boolean>;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExpandedLists: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExpandedCompleted: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onToggle: (listId: string, itemId: string) => void;
  onAddItem: (listId: string, text: string) => void;
  onEditReminder: (listId: string, itemId: string) => void;
  onRenameList: (listId: string, title: string) => void;
  onEditItem: (listId: string, itemId: string, text: string) => void | Promise<void>;
  onDeleteItem: (listId: string, itemId: string) => void | Promise<void>;
  onOpenSourceNote: (noteId: string) => void;
}) {
  const descendantIds = useMemo(() => Array.from(collectFolderIds(folder)), [folder]);
  const listsInFolder = todoLists.filter(list => list.folderId === folder.id);
  const childFolders = folder.children.filter(child =>
    todoLists.some(list => collectFolderIds(child).has(list.folderId))
  );
  const openCount = todoLists
    .filter(list => descendantIds.includes(list.folderId))
    .reduce((sum, list) => sum + list.items.filter(item => !item.done).length, 0);
  const expanded = expandedFolders[folder.id] ?? true;
  const isFocused = focusedFolderId === folder.id;

  if (listsInFolder.length === 0 && childFolders.length === 0) {
    return null;
  }

  return (
    <View style={[styles.folderSection, isFocused && styles.folderSectionFocused]}>
      <TouchableOpacity
        style={styles.folderHeader}
        onPress={() =>
          setExpandedFolders(current => ({
            ...current,
            [folder.id]: !(current[folder.id] ?? true),
          }))
        }
        activeOpacity={0.85}
      >
        <View style={styles.folderHeaderTextWrap}>
          <Text style={styles.folderTitle}>{folder.name}</Text>
          <Text style={styles.folderMeta}>
            {openCount} open{listsInFolder.length ? ` · ${listsInFolder.length} list${listsInFolder.length === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.folderBody}>
          {listsInFolder.map(list => (
            <TodoListSection
              key={list.id}
              list={list}
              focused={focusedListId === list.id}
              expanded={expandedLists[list.id] ?? true}
              onToggleExpanded={() =>
                setExpandedLists(current => ({
                  ...current,
                  [list.id]: !(current[list.id] ?? true),
                }))
              }
              onToggle={onToggle}
              onAddItem={onAddItem}
              onEditReminder={onEditReminder}
              onRenameList={onRenameList}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
              onOpenSourceNote={onOpenSourceNote}
              completedExpanded={!!expandedCompleted[list.id]}
              onToggleCompletedExpanded={() =>
                setExpandedCompleted(current => ({
                  ...current,
                  [list.id]: !current[list.id],
                }))
              }
            />
          ))}

          {childFolders.map(child => (
            <View key={child.id} style={styles.childFolderWrap}>
              <FolderSection
                folder={child}
                todoLists={todoLists}
                focusedFolderId={focusedFolderId}
                focusedListId={focusedListId}
                expandedFolders={expandedFolders}
                expandedLists={expandedLists}
                expandedCompleted={expandedCompleted}
                setExpandedFolders={setExpandedFolders}
                setExpandedLists={setExpandedLists}
                setExpandedCompleted={setExpandedCompleted}
                onToggle={onToggle}
                onAddItem={onAddItem}
                onEditReminder={onEditReminder}
                onRenameList={onRenameList}
                onEditItem={onEditItem}
                onDeleteItem={onDeleteItem}
                onOpenSourceNote={onOpenSourceNote}
              />
            </View>
          ))}
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
  onRenameList,
  onEditItem,
  onDeleteItem,
  onOpenSourceNote,
}: Props) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});
  const [expandedCompleted, setExpandedCompleted] = useState<Record<string, boolean>>({});
  const rootLists = todoLists.filter(list => list.folderId === 'root');
  const visibleFolders = tree.children.filter(folder =>
    todoLists.some(list => collectFolderIds(folder).has(list.folderId))
  );
  const openCount = countOpenItems(todoLists);

  useEffect(() => {
    setExpandedFolders(current => {
      const next = { ...current };
      tree.children.forEach(folder => {
        if (next[folder.id] === undefined) {
          next[folder.id] = true;
        }
      });
      return next;
    });
  }, [tree]);

  useEffect(() => {
    setExpandedLists(current => {
      const next = { ...current };
      todoLists.forEach(list => {
        if (next[list.id] === undefined) {
          next[list.id] = true;
        }
      });
      return next;
    });
  }, [todoLists]);

  useEffect(() => {
    if (focusedFolderId) {
      setExpandedFolders(current => ({ ...current, [focusedFolderId]: true }));
    }
    if (focusedListId) {
      setExpandedLists(current => ({ ...current, [focusedListId]: true }));
    }
  }, [focusedFolderId, focusedListId]);

  const allCollapsed = visibleFolders.every(folder => !(expandedFolders[folder.id] ?? true));

  return (
    <View style={styles.container}>
      <TopBar subtitle="Category → list → items" title="To-Dos" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.toolbar}>
          <View style={styles.toolbarTextWrap}>
            <Text style={styles.toolbarTitle}>Your lists</Text>
            <Text style={styles.toolbarSubtitle}>{openCount} open items across your categories</Text>
          </View>
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={() =>
              setExpandedFolders(current => {
                const next: Record<string, boolean> = { ...current };
                visibleFolders.forEach(folder => {
                  next[folder.id] = allCollapsed;
                });
                return next;
              })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.toolbarBtnText}>{allCollapsed ? 'Expand all' : 'Collapse all'}</Text>
          </TouchableOpacity>
        </View>

        {todoLists.length === 0 ? (
          <Text style={styles.empty}>
            To-do lists will appear here when you speak a clear list of tasks into the Home mic.
          </Text>
        ) : (
          <>
            {rootLists.length > 0 ? (
              <View style={styles.uncategorizedSection}>
                <Text style={styles.uncategorizedTitle}>Uncategorized</Text>
                {rootLists.map(list => (
                  <TodoListSection
                    key={list.id}
                    list={list}
                    focused={focusedListId === list.id}
                    expanded={expandedLists[list.id] ?? true}
                    onToggleExpanded={() =>
                      setExpandedLists(current => ({
                        ...current,
                        [list.id]: !(current[list.id] ?? true),
                      }))
                    }
                    onToggle={onToggle}
                    onAddItem={onAddItem}
                    onEditReminder={onEditReminder}
                    onRenameList={onRenameList}
                    onEditItem={onEditItem}
                    onDeleteItem={onDeleteItem}
                    onOpenSourceNote={onOpenSourceNote}
                    completedExpanded={!!expandedCompleted[list.id]}
                    onToggleCompletedExpanded={() =>
                      setExpandedCompleted(current => ({
                        ...current,
                        [list.id]: !current[list.id],
                      }))
                    }
                  />
                ))}
              </View>
            ) : null}

            {visibleFolders.map(folder => (
              <FolderSection
                key={folder.id}
                folder={folder}
                todoLists={todoLists}
                focusedFolderId={focusedFolderId}
                focusedListId={focusedListId}
                expandedFolders={expandedFolders}
                expandedLists={expandedLists}
                expandedCompleted={expandedCompleted}
                setExpandedFolders={setExpandedFolders}
                setExpandedLists={setExpandedLists}
                setExpandedCompleted={setExpandedCompleted}
                onToggle={onToggle}
                onAddItem={onAddItem}
                onEditReminder={onEditReminder}
                onRenameList={onRenameList}
                onEditItem={onEditItem}
                onDeleteItem={onDeleteItem}
                onOpenSourceNote={onOpenSourceNote}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 12, paddingBottom: 28 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  toolbarTextWrap: {
    flex: 1,
  },
  toolbarTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: '700',
    color: COLORS.brown,
  },
  toolbarSubtitle: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    marginTop: 3,
  },
  toolbarBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: COLORS.white50,
  },
  toolbarBtnText: {
    fontSize: FONTS.size.xs,
    color: COLORS.brown,
    fontWeight: '600',
  },
  empty: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownFaint,
    textAlign: 'center',
    marginTop: 28,
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  uncategorizedSection: {
    marginBottom: 16,
  },
  uncategorizedTitle: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownLight,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  folderSection: {
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(110, 83, 67, 0.1)',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  folderSectionFocused: {
    borderColor: COLORS.brown,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(123, 93, 72, 0.1)',
  },
  folderHeaderTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  folderTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '700',
    color: COLORS.brown,
  },
  folderMeta: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    marginTop: 4,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
    color: COLORS.brown,
    width: 20,
    textAlign: 'center',
  },
  folderBody: {
    padding: 10,
    gap: 10,
  },
  childFolderWrap: {
    paddingLeft: 8,
  },
  listCard: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    overflow: 'hidden',
  },
  listFocused: {
    borderColor: COLORS.brown,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  listHeaderTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  listTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '700',
    color: COLORS.brown,
  },
  listMeta: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    marginTop: 3,
  },
  listTitleInput: {
    backgroundColor: COLORS.white60,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FONTS.size.md,
    color: COLORS.brown,
    fontWeight: '700',
  },
  listBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
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
    marginTop: 2,
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
  inlineEditInput: {
    backgroundColor: COLORS.white60,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FONTS.size.sm,
    color: COLORS.brown,
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
  sourcePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: 'rgba(181, 72, 47, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sourcePillText: {
    fontSize: FONTS.size.xs,
    color: COLORS.red,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
  },
  rowActionText: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
  },
  deleteText: {
    fontSize: FONTS.size.xs,
    color: COLORS.red,
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
