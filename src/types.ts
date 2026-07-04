export interface FolderNode {
  id: string;
  name: string;
  children: FolderNode[];
}

export interface FlatFolder {
  id: string;
  name: string;
  path: string[];
}

export interface ActionItem {
  text: string;
  due: string | null;
  done: boolean;
}

export interface EventSourceNote {
  noteId: string;
  noteTitle: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startAt: number;
  endAt: number;
  allDay: boolean;
  categoryFolderId: string | null;
  todoListId: string | null;
  todoItemId: string | null;
  sourceNote: EventSourceNote | null;
  kind: 'calendar' | 'action_item';
  ts: number;
}

export interface Note {
  id: string;
  title: string;
  summary: string;
  transcript: string;
  folderId: string;
  ts: number;
  callMode: boolean;
  actionItems: ActionItem[];
}

export interface PendingActionItem {
  text: string;
  due: string | null;
  inferred: boolean;
}

export interface BasePendingCapture {
  id: string;
  contentType: 'note' | 'todo_items' | 'calendar_entries';
  title: string;
  summary: string;
  transcript: string;
  existingFolderId: string | null;
  newFolderSuggestion: { parentId: string; name: string } | null;
}

export interface PendingNote extends BasePendingCapture {
  contentType: 'note';
  actionItems: PendingActionItem[];
}

export interface PendingTodoCapture extends BasePendingCapture {
  contentType: 'todo_items';
  existingTodoListId: string | null;
  newTodoListTitle: string | null;
  todoItems: { text: string; due: string | null }[];
}

export interface PendingCalendarEntry {
  title: string;
  date: string | null;
  time: string | null;
  durationMinutes: number | null;
}

export interface PendingCalendarCapture extends BasePendingCapture {
  contentType: 'calendar_entries';
  calendarEntries: PendingCalendarEntry[];
}

export type PendingCapture = PendingNote | PendingTodoCapture | PendingCalendarCapture;

export interface KeeperItem {
  id: string;
  kind: 'link' | 'text';
  text: string;
  url: string | null;
  title: string;
  summary: string;
  categoryId: string;
  ts: number;
}

export interface TodoItem {
  id: string;
  text: string;
  due: string | null;
  reminderAt: number | null;
  notificationId: string | null;
  done: boolean;
  ts: number;
  fromNote: EventSourceNote | null;
}

export interface TodoList {
  id: string;
  title: string;
  folderId: string;
  items: TodoItem[];
  ts: number;
}

export interface AppSettings {
  openaiKey: string;
  anthropicKey: string;
  microphonePermissionAsked?: boolean;
  notificationsPermissionAsked?: boolean;
  areas: string;
  schedule: string;
  coffee: string;
  coffeePeople: string;
  yeshiva: string;
  yeshivaPeople: string;
  urgency: string;
  vocabulary: string;
  privacy: string;
}
