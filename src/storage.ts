import AsyncStorage from '@react-native-async-storage/async-storage';
import { FolderNode, Note, AppSettings } from './types';

const KEY = 'notekeeper:state:v1';

interface AppState {
  tree?: FolderNode;
  notes?: Note[];
  settings?: Partial<AppSettings>;
}

export async function loadAppState(): Promise<AppState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch (e) {
    console.error('loadAppState error', e);
    return null;
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('saveAppState error', e);
  }
}
