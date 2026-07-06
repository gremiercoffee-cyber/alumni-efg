import type { AppSettings, CalendarEvent, FolderNode, KeeperItem, Note, TodoItem, TodoList } from '../types';
import { EMPTY_KEEPER_TREE, EMPTY_TREE } from '../constants';
import { supabase } from './supabase';

export type TodoCategory = FolderNode;

type FolderKind = 'notes' | 'todos' | 'keeper';

function throwIfError(error: unknown) {
  if (error) throw error;
}

function normalizeTodoList(list: TodoList): TodoList {
  return {
    ...list,
    items: (list.items || []).map(item => ({
      ...item,
      reminderAt: item.reminderAt ?? null,
      notificationId: item.notificationId ?? null,
      eventId: item.eventId ?? null,
      fromNote: item.fromNote ?? null,
    })),
  };
}

function normalizeCalendarEvent(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    done: event.done ?? false,
    sourceNote: event.sourceNote ?? null,
    eventType: event.eventType ?? (event.kind === 'action_item' ? 'task' : 'other'),
  };
}

async function getTree(userId: string, kind: FolderKind, fallback: FolderNode): Promise<FolderNode> {
  const { data, error } = await supabase
    .from('folder_trees')
    .select('tree')
    .eq('user_id', userId)
    .eq('kind', kind)
    .maybeSingle();
  throwIfError(error);
  return (data?.tree as FolderNode | null) || fallback;
}

async function saveTree(userId: string, kind: FolderKind, tree: FolderNode): Promise<void> {
  const { error } = await supabase
    .from('folder_trees')
    .upsert({ user_id: userId, kind, tree }, { onConflict: 'user_id,kind' });
  throwIfError(error);
}

export async function getFolderTree(userId: string): Promise<FolderNode> {
  return getTree(userId, 'notes', EMPTY_TREE);
}

export async function saveFolderTree(userId: string, tree: FolderNode): Promise<void> {
  await saveTree(userId, 'notes', tree);
}

export async function getTodoCategories(userId: string): Promise<TodoCategory[]> {
  return [await getTree(userId, 'todos', EMPTY_TREE)];
}

export async function saveTodoCategory(userId: string, category: TodoCategory): Promise<void> {
  await saveTree(userId, 'todos', category);
}

export async function deleteTodoCategory(userId: string, _categoryId: string): Promise<void> {
  await saveTree(userId, 'todos', EMPTY_TREE);
}

export async function getKeeperCategories(userId: string): Promise<FolderNode> {
  return getTree(userId, 'keeper', EMPTY_KEEPER_TREE);
}

export async function saveKeeperCategories(userId: string, tree: FolderNode): Promise<void> {
  await saveTree(userId, 'keeper', tree);
}

export async function getNotes(userId: string): Promise<Note[]> {
  const { data, error } = await supabase.from('notes').select('*').eq('user_id', userId).order('ts', { ascending: false });
  throwIfError(error);
  return (data || []).map(row => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    transcript: row.transcript,
    folderId: row.folder_id,
    ts: row.ts,
    callMode: row.call_mode,
    actionItems: row.action_items || [],
  }));
}

export async function saveNote(userId: string, note: Note): Promise<void> {
  const { error } = await supabase.from('notes').upsert({
    id: note.id,
    user_id: userId,
    title: note.title,
    summary: note.summary,
    transcript: note.transcript,
    folder_id: note.folderId,
    ts: note.ts,
    call_mode: note.callMode,
    action_items: note.actionItems,
  });
  throwIfError(error);
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('user_id', userId).eq('id', noteId);
  throwIfError(error);
}

export async function getTodoLists(userId: string): Promise<TodoList[]> {
  const { data, error } = await supabase.from('todo_lists').select('*').eq('user_id', userId).order('ts', { ascending: false });
  throwIfError(error);
  return (data || []).map(row => normalizeTodoList({
    id: row.id,
    title: row.title,
    folderId: row.folder_id,
    items: row.items || [],
    ts: row.ts,
  }));
}

export async function saveTodoList(userId: string, list: TodoList): Promise<void> {
  const { error } = await supabase.from('todo_lists').upsert({
    id: list.id,
    user_id: userId,
    title: list.title,
    folder_id: list.folderId,
    items: list.items,
    ts: list.ts,
  });
  throwIfError(error);
}

export async function deleteTodoList(userId: string, listId: string): Promise<void> {
  const { error } = await supabase.from('todo_lists').delete().eq('user_id', userId).eq('id', listId);
  throwIfError(error);
}

export async function getTodoItems(userId: string): Promise<TodoItem[]> {
  return (await getTodoLists(userId)).flatMap(list => list.items);
}

export async function saveTodoItem(userId: string, item: TodoItem): Promise<void> {
  const lists = await getTodoLists(userId);
  const list = lists.find(entry => entry.items.some(todo => todo.id === item.id));
  if (!list) return;
  await saveTodoList(userId, { ...list, items: list.items.map(todo => (todo.id === item.id ? item : todo)) });
}

export async function updateTodoItem(userId: string, itemId: string, updates: Partial<TodoItem>): Promise<void> {
  const lists = await getTodoLists(userId);
  const list = lists.find(entry => entry.items.some(todo => todo.id === itemId));
  if (!list) return;
  await saveTodoList(userId, {
    ...list,
    items: list.items.map(todo => (todo.id === itemId ? { ...todo, ...updates } : todo)),
  });
}

export async function deleteTodoItem(userId: string, itemId: string): Promise<void> {
  const lists = await getTodoLists(userId);
  const list = lists.find(entry => entry.items.some(todo => todo.id === itemId));
  if (!list) return;
  await saveTodoList(userId, { ...list, items: list.items.filter(todo => todo.id !== itemId) });
}

export async function getCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase.from('calendar_events').select('*').eq('user_id', userId).order('start_at', { ascending: true });
  throwIfError(error);
  return (data || []).map(row => normalizeCalendarEvent({
    id: row.id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: row.all_day,
    done: row.done,
    categoryFolderId: row.category_folder_id,
    todoListId: row.todo_list_id,
    todoItemId: row.todo_item_id,
    sourceNote: row.source_note,
    kind: row.kind,
    eventType: row.event_type,
    ts: row.ts,
  }));
}

export async function saveCalendarEvent(userId: string, event: CalendarEvent): Promise<void> {
  const { error } = await supabase.from('calendar_events').upsert({
    id: event.id,
    user_id: userId,
    title: event.title,
    start_at: event.startAt,
    end_at: event.endAt,
    all_day: event.allDay,
    done: event.done,
    category_folder_id: event.categoryFolderId,
    todo_list_id: event.todoListId,
    todo_item_id: event.todoItemId,
    source_note: event.sourceNote,
    kind: event.kind,
    event_type: event.eventType,
    ts: event.ts,
  });
  throwIfError(error);
}

export async function updateCalendarEvent(userId: string, eventId: string, updates: Partial<CalendarEvent>): Promise<void> {
  const current = (await getCalendarEvents(userId)).find(event => event.id === eventId);
  if (!current) return;
  await saveCalendarEvent(userId, { ...current, ...updates });
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase.from('calendar_events').delete().eq('user_id', userId).eq('id', eventId);
  throwIfError(error);
}

export async function getKeeperItems(userId: string): Promise<KeeperItem[]> {
  const { data, error } = await supabase.from('keeper_items').select('*').eq('user_id', userId).order('ts', { ascending: false });
  throwIfError(error);
  return (data || []).map(row => ({
    id: row.id,
    kind: row.kind,
    text: row.text,
    url: row.url,
    title: row.title,
    summary: row.summary,
    categoryId: row.category_id,
    ts: row.ts,
  }));
}

export async function saveKeeperItem(userId: string, item: KeeperItem): Promise<void> {
  const { error } = await supabase.from('keeper_items').upsert({
    id: item.id,
    user_id: userId,
    kind: item.kind,
    text: item.text,
    url: item.url,
    title: item.title,
    summary: item.summary,
    category_id: item.categoryId,
    ts: item.ts,
  });
  throwIfError(error);
}

export async function updateKeeperItem(userId: string, itemId: string, updates: Partial<KeeperItem>): Promise<void> {
  const current = (await getKeeperItems(userId)).find(item => item.id === itemId);
  if (!current) return;
  await saveKeeperItem(userId, { ...current, ...updates });
}

export async function deleteKeeperItem(userId: string, itemId: string): Promise<void> {
  const { error } = await supabase.from('keeper_items').delete().eq('user_id', userId).eq('id', itemId);
  throwIfError(error);
}

export async function getUserSettings(userId: string): Promise<AppSettings | null> {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  throwIfError(error);
  if (!data) return null;
  return {
    anthropicKey: data.anthropic_key || '',
    microphonePermissionAsked: data.microphone_permission_asked || false,
    notificationsPermissionAsked: data.notifications_permission_asked || false,
    areas: data.areas || '',
    schedule: data.schedule || '',
    coffee: data.coffee || '',
    coffeePeople: data.coffee_people || '',
    yeshiva: data.yeshiva || '',
    yeshivaPeople: data.yeshiva_people || '',
    urgency: data.urgency || '',
    vocabulary: data.vocabulary || '',
    privacy: data.privacy || '',
  };
}

export async function saveUserSettings(userId: string, settings: AppSettings): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    anthropic_key: settings.anthropicKey,
    microphone_permission_asked: settings.microphonePermissionAsked || false,
    notifications_permission_asked: settings.notificationsPermissionAsked || false,
    areas: settings.areas,
    schedule: settings.schedule,
    coffee: settings.coffee,
    coffee_people: settings.coffeePeople,
    yeshiva: settings.yeshiva,
    yeshiva_people: settings.yeshivaPeople,
    urgency: settings.urgency,
    vocabulary: settings.vocabulary,
    privacy: settings.privacy,
  }, { onConflict: 'user_id' });
  throwIfError(error);
}
