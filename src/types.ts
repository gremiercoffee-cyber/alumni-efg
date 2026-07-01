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

export interface PendingNote {
  id: string;
  title: string;
  summary: string;
  transcript: string;
  existingFolderId: string | null;
  newFolderSuggestion: { parentId: string; name: string } | null;
  actionItems: PendingActionItem[];
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
