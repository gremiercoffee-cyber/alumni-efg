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
  contentType: 'note' | 'todo_items';
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

export type PendingCapture = PendingNote | PendingTodoCapture;

export interface SavedLink {
  id: string;
  url: string;
  title: string;
  summary: string;
  categoryId: string;
  ts: number;
}

export interface TodoItem {
  id: string;
  text: string;
  due: string | null;
  done: boolean;
  ts: number;
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
