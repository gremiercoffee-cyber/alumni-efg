import {
  AppSettings,
  FlatFolder,
  FolderNode,
  PendingCapture,
  TodoList,
} from '../types';
import { flattenFolders } from '../utils';
import { supabase } from './supabase';

interface ClassifyInput {
  transcript: string;
  folderList: FlatFolder[];
  todoLists: TodoList[];
  settings: AppSettings;
}

interface ClassifyKeeperInput {
  text: string;
  keeperTree: FolderNode;
  url?: string | null;
}

export interface KeeperClassification {
  title: string;
  summary: string;
  existingCategoryId: string | null;
  newCategorySuggestion: { parentId: string; name: string } | null;
}

async function callClassifyFunction(payload: Record<string, unknown>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/classify`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(`Classification failed: ${await response.text()}`);
  }

  return response.json();
}

export async function classifyNote({
  transcript,
  folderList,
  todoLists,
  settings,
}: ClassifyInput): Promise<Omit<PendingCapture, 'id' | 'transcript'>> {
  return callClassifyFunction({
    transcript,
    folderList,
    todoLists,
    settings,
  });
}

export async function classifyKeeperItem({
  text,
  keeperTree,
  url,
}: ClassifyKeeperInput): Promise<KeeperClassification> {
  return callClassifyFunction({
    mode: 'keeper',
    text,
    url: url || null,
    keeperFolders: flattenFolders(keeperTree),
  });
}
