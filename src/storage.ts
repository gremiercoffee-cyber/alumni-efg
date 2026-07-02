import AsyncStorage from '@react-native-async-storage/async-storage';
import { FolderNode, Note, AppSettings, SavedLink, TodoList } from './types';

const KEY = 'notekeeper:state:v2';
const SETTINGS_KEY = 'notekeeper:settings:v1';
const LEGACY_KEYS = ['notekeeper:state:v1'];

interface AppState {
  tree?: FolderNode;
  keeperTree?: FolderNode;
  notes?: Note[];
  savedLinks?: SavedLink[];
  todoLists?: TodoList[];
  settings?: Partial<AppSettings>;
}

export async function loadAppState(): Promise<AppState | null> {
  try {
    const [raw, savedSettings, ...legacyRawStates] = await Promise.all([
      AsyncStorage.getItem(KEY),
      AsyncStorage.getItem(SETTINGS_KEY),
      ...LEGACY_KEYS.map(key => AsyncStorage.getItem(key)),
    ]);

    const state = raw ? JSON.parse(raw) as AppState : null;
    const settingsFromStableKey = savedSettings
      ? JSON.parse(savedSettings) as Partial<AppSettings>
      : {};
    const settingsFromLegacyState = legacyRawStates
      .map(legacyRaw => {
        if (!legacyRaw) return {};
        try {
          return (JSON.parse(legacyRaw) as AppState).settings || {};
        } catch {
          return {};
        }
      })
      .reduce<Partial<AppSettings>>(
        (merged, legacySettings) => mergeNonEmptySettings(merged, legacySettings),
        {}
      );

    const recoveredSettings = mergeNonEmptySettings(
      settingsFromLegacyState,
      settingsFromStableKey
    );

    if (!state) {
      return Object.keys(recoveredSettings).length ? { settings: recoveredSettings } : null;
    }

    return {
      ...state,
      settings: mergeNonEmptySettings(recoveredSettings, state.settings || {}),
    };
  } catch (e) {
    console.error('loadAppState error', e);
    return null;
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(KEY, JSON.stringify(state)),
      state.settings
        ? AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings))
        : Promise.resolve(),
    ]);
  } catch (e) {
    console.error('saveAppState error', e);
  }
}

function mergeNonEmptySettings(
  base: Partial<AppSettings>,
  override: Partial<AppSettings>
): Partial<AppSettings> {
  const merged: Partial<AppSettings> = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      merged[key as keyof AppSettings] = value;
    }
  });
  return merged;
}
