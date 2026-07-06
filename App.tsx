import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Audio } from 'expo-av';
import RecordingScreen from './src/screens/RecordingScreen';
import ProcessingScreen from './src/screens/ProcessingScreen';
import FoldersScreen from './src/screens/FoldersScreen';
import FolderDetailScreen from './src/screens/FolderDetailScreen';
import KeeperScreen from './src/screens/KeeperScreen';
import ToDosScreen from './src/screens/ToDosScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import TabBar from './src/components/TabBar';
import TodoReminderModal from './src/components/TodoReminderModal';
import { loadAppState, saveAppState } from './src/storage';
import { classifyKeeperItem, classifyNote } from './src/lib/classify';
import { transcribeAudio } from './src/lib/transcribe';
import {
  attachNotificationOpener,
  cancelTodoReminder,
  requestReminderPermissions,
  scheduleTodoReminder,
} from './src/lib/reminders';
import {
  addChildFolder,
  assignCategoryColor,
  collectFolderIds,
  deleteFolder,
  ensureFolder,
  extractFirstUrl,
  findFolderByName,
  findNode,
  flattenFolders,
  formatClockTime,
  formatReminderLabel,
  folderPathLabel,
  makeId,
  parseNaturalDateTime,
  parseSuggestedReminder,
  nextCategoryColor,
  renameFolder,
  withDuration,
} from './src/utils';
import { EMPTY_KEEPER_TREE, EMPTY_TREE, COLORS, FONTS } from './src/constants';
import type {
  CalendarEvent,
  FolderNode,
  Note,
  PendingCapture,
  AppSettings,
  KeeperItem,
  TodoList,
  TodoItem,
  EventSourceNote,
} from './src/types';

export type Tab = 'schedule' | 'notes' | 'keeper' | 'todos' | 'settings';
export type Flow = 'idle' | 'recording' | 'processing';
type CaptureTarget = 'general' | 'keeper';

interface ReminderQueueItem {
  listId: string;
  itemId: string;
  folderId: string;
  text: string;
  suggestedDue: string | null;
}

type TodoExpandState = {
  folders: Record<string, boolean>;
  lists: Record<string, boolean>;
  completed: Record<string, boolean>;
};

function sharedTextFromUrl(url: string): string | null {
  const match = url.match(/[?&]text=([^&]+)/);
  return match ? decodeURIComponent(match[1].replace(/\+/g, '%20')) : null;
}

function todoTargetFromUrl(url: string): { listId: string | null; folderId: string | null } | null {
  if (!url.includes('://todo')) return null;
  const listId = url.match(/[?&]listId=([^&]+)/)?.[1];
  const folderId = url.match(/[?&]folderId=([^&]+)/)?.[1];
  return {
    listId: listId ? decodeURIComponent(listId) : null,
    folderId: folderId ? decodeURIComponent(folderId) : null,
  };
}

function ReviewContent({
  pending,
  tree,
  todoLists,
}: {
  pending: PendingCapture | null;
  tree: FolderNode;
  todoLists: TodoList[];
}) {
  if (!pending) {
    return <Text style={styles.reviewEmptyText}>Nothing was extracted - try recording again.</Text>;
  }

  const allFolders = flattenFolders(tree);
  const folderLabel = pending.existingFolderId
    ? folderPathLabel(pending.existingFolderId, allFolders)
    : pending.newFolderSuggestion
    ? `New: ${folderPathLabel(pending.newFolderSuggestion.parentId, allFolders)} / ${pending.newFolderSuggestion.name}`
    : 'Everything';

  if (pending.contentType === 'todo_items') {
    const todoListLabel = pending.existingTodoListId
      ? todoLists.find(list => list.id === pending.existingTodoListId)?.title || 'Existing list'
      : pending.newTodoListTitle || pending.title || 'New to-do list';

    return (
      <View style={styles.reviewBody}>
        <View style={styles.reviewSummaryCard}>
          <Text style={styles.reviewTitle}>{pending.title || 'New to-dos'}</Text>
          <Text style={styles.reviewMeta}>Category: {folderLabel}</Text>
          <Text style={styles.reviewMeta}>Target list: {todoListLabel}</Text>
        </View>
        {pending.todoItems.length ? (
          pending.todoItems.map((item, index) => (
            <View key={`${item.text}-${index}`} style={styles.reviewRow}>
              <Text style={styles.reviewBullet}>-</Text>
              <View style={styles.reviewRowText}>
                <Text style={styles.reviewItemTitle}>{item.text || 'Untitled task'}</Text>
                <Text style={styles.reviewMeta}>List: {todoListLabel}</Text>
                <Text style={styles.reviewMeta}>Reminder: {item.due || 'None inferred'}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.reviewEmptyText}>Nothing was extracted - try recording again.</Text>
        )}
      </View>
    );
  }

  if (pending.contentType === 'calendar_entries') {
    return (
      <View style={styles.reviewBody}>
        <View style={styles.reviewSummaryCard}>
          <Text style={styles.reviewTitle}>{pending.title || 'New events'}</Text>
          <Text style={styles.reviewMeta}>{pending.summary || 'Review each extracted event before saving.'}</Text>
        </View>
        {pending.calendarEntries.length ? (
          pending.calendarEntries.map((entry, index) => (
            <View key={`${entry.title}-${index}`} style={styles.reviewRow}>
              <Text style={styles.reviewBullet}>-</Text>
              <View style={styles.reviewRowText}>
                <Text style={styles.reviewItemTitle}>{entry.title || 'Untitled event'}</Text>
                <Text style={styles.reviewMeta}>Date: {entry.date || 'Today'}</Text>
                <Text style={styles.reviewMeta}>Time: {entry.time || 'All day'}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.reviewEmptyText}>Nothing was extracted - try recording again.</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.reviewBody}>
      <View style={styles.reviewSummaryCard}>
        <Text style={styles.reviewTitle}>{pending.title || 'New note'}</Text>
        <Text style={styles.reviewMeta}>Folder: {folderLabel}</Text>
        <Text style={styles.reviewParagraph}>{pending.summary || 'No summary extracted.'}</Text>
      </View>
      {pending.actionItems.length ? (
        pending.actionItems.map((item, index) => (
          <View key={`${item.text}-${index}`} style={styles.reviewRow}>
            <Text style={styles.reviewBullet}>-</Text>
            <View style={styles.reviewRowText}>
              <Text style={styles.reviewItemTitle}>{item.text || 'Untitled action item'}</Text>
              <Text style={styles.reviewMeta}>Due: {item.due || 'No due date inferred'}</Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.reviewEmptyText}>Nothing was extracted - try recording again.</Text>
      )}
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('schedule');
  const [flow, setFlow] = useState<Flow>('idle');
  const [callMode, setCallMode] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget>('general');
  const [tree, setTree] = useState<FolderNode>(EMPTY_TREE);
  const [todoTree, setTodoTree] = useState<FolderNode>(EMPTY_TREE);
  const [keeperTree, setKeeperTree] = useState<FolderNode>(EMPTY_KEEPER_TREE);
  const [notes, setNotes] = useState<Note[]>([]);
  const [keeperItems, setKeeperItems] = useState<KeeperItem[]>([]);
  const [todoLists, setTodoLists] = useState<TodoList[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    openaiKey: '',
    anthropicKey: '',
    microphonePermissionAsked: false,
    notificationsPermissionAsked: false,
    areas: '',
    schedule: '',
    coffee: '',
    coffeePeople: '',
    yeshiva: '',
    yeshivaPeople: '',
    urgency: '',
    vocabulary: '',
    privacy: '',
  });
  const [pending, setPending] = useState<PendingCapture | null>(null);
  const [openFolder, setOpenFolder] = useState<FolderNode | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordModeSheetOpen, setRecordModeSheetOpen] = useState(false);
  const [keeperProcessing, setKeeperProcessing] = useState(false);
  const [todoFocusFolderId, setTodoFocusFolderId] = useState<string | null>(null);
  const [todoFocusListId, setTodoFocusListId] = useState<string | null>(null);
  const [reminderQueue, setReminderQueue] = useState<ReminderQueueItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [todoExpandState, setTodoExpandState] = useState<TodoExpandState>({
    folders: {},
    lists: {},
    completed: {},
  });
  const handledShareUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = setTimeout(() => setToastMessage(null), 2200);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!openFolder) return;
    const refreshed = findNode(tree, openFolder.id);
    setOpenFolder(refreshed);
  }, [tree, openFolder]);

  useEffect(() => {
    loadAppState().then(s => {
      if (s) {
        if (s.tree) setTree(s.tree);
        if (s.todoTree) setTodoTree(s.todoTree);
        else if (s.tree) setTodoTree(s.tree);
        if (s.keeperTree) setKeeperTree(s.keeperTree);
        if (s.notes) setNotes(s.notes);
        if (s.keeperItems) setKeeperItems(s.keeperItems);
        if (s.todoLists) setTodoLists(s.todoLists);
        if (s.calendarEvents) setCalendarEvents(s.calendarEvents);
        if (s.settings) setSettings(prev => ({ ...prev, ...s.settings }));
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveAppState({ tree, todoTree, keeperTree, notes, keeperItems, todoLists, calendarEvents, settings });
  }, [tree, todoTree, keeperTree, notes, keeperItems, todoLists, calendarEvents, settings, loaded]);

  useEffect(() => {
    if (!loaded || settings.microphonePermissionAsked) return;
    Audio.requestPermissionsAsync()
      .then(() => setSettings(prev => ({ ...prev, microphonePermissionAsked: true })))
      .catch(errorValue => {
        console.warn('Initial microphone permission request failed', errorValue);
      });
  }, [loaded, settings.microphonePermissionAsked]);

  useEffect(() => {
    return attachNotificationOpener(url => {
      const target = todoTargetFromUrl(url);
      if (!target) return;
      setFlow('idle');
      setTab('todos');
      setTodoFocusFolderId(target.folderId);
      setTodoFocusListId(target.listId);
    });
  }, []);

  const handleIncomingUrl = async (url: string) => {
    const todoTarget = todoTargetFromUrl(url);
    if (todoTarget) {
      setFlow('idle');
      setTab('todos');
      setTodoFocusFolderId(todoTarget.folderId);
      setTodoFocusListId(todoTarget.listId);
      return;
    }

    if (handledShareUrls.current.has(url)) return;
    handledShareUrls.current.add(url);
    const sharedText = sharedTextFromUrl(url);
    if (sharedText) {
      const extractedUrl = extractFirstUrl(sharedText);
      await saveKeeperItem(sharedText, extractedUrl || null);
    }
  };

  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (url) handleIncomingUrl(url);
    });
    const subscription = Linking.addEventListener('url', event => {
      handleIncomingUrl(event.url);
    });
    return () => subscription.remove();
  }, [keeperTree, settings.openaiKey]);

  const saveKeeperItem = async (text: string, url?: string | null) => {
    setTab('keeper');
    setError(null);

    if (!settings.openaiKey) {
      setError('No OpenAI key. Add it in Settings first.');
      return;
    }

    setKeeperProcessing(true);
    try {
      const classification = await classifyKeeperItem({
        text,
        url: url || null,
        keeperTree,
        openaiKey: settings.openaiKey,
      });

      let nextKeeperTree = keeperTree;
      let categoryId = classification.existingCategoryId;
      if (!categoryId && classification.newCategorySuggestion) {
        const added = addChildFolder(
          keeperTree,
          classification.newCategorySuggestion.parentId || 'keeper-root',
          classification.newCategorySuggestion.name,
          'k'
        );
        nextKeeperTree = added.tree;
        categoryId = added.id;
      }

      const item: KeeperItem = {
        id: makeId('keep'),
        kind: url ? 'link' : 'text',
        text,
        url: url || null,
        title: classification.title || (url || text),
        summary: classification.summary || text,
        categoryId: categoryId || 'keeper-root',
        ts: Date.now(),
      };

      setKeeperTree(nextKeeperTree);
      setKeeperItems(items => [item, ...items]);
    } catch (e: any) {
      setError(e.message || 'Could not save to Keeper.');
    } finally {
      setKeeperProcessing(false);
      setFlow('idle');
    }
  };

  const startQuickCapture = () => {
    setCaptureTarget('general');
    setCallMode(false);
    setError(null);
    setFlow('recording');
  };

  const openRecordingChooser = () => {
    setError(null);
    setRecordModeSheetOpen(true);
  };

  const startKeeperRecording = () => {
    setCaptureTarget('keeper');
    setCallMode(false);
    setError(null);
    setTab('keeper');
    setFlow('recording');
  };

  const startMeetingCapture = () => {
    setCaptureTarget('general');
    setCallMode(true);
    setRecordModeSheetOpen(false);
    setFlow('recording');
  };

  const handleRecordingComplete = async (audioUri: string) => {
    try {
      if (!settings.openaiKey) throw new Error('No OpenAI key. Add it in Settings first.');
      const transcript = await transcribeAudio(audioUri, settings.openaiKey);

      if (captureTarget === 'keeper') {
        await saveKeeperItem(transcript, null);
        return;
      }

      const folderList = flattenFolders(tree);
      const classification = await classifyNote({
        transcript,
        folderList,
        todoLists,
        settings,
        openaiKey: settings.openaiKey,
      });
      setPending({ ...classification, transcript, id: makeId('pending') } as PendingCapture);
      setFlow('idle');
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Check your API keys in Settings.');
      setFlow('idle');
    } finally {
      setCaptureTarget('general');
    }
  };

  const resolveFolderInTree = (
    sourceTree: FolderNode,
    pendingCapture: PendingCapture
  ): { folderId: string; nextTree: FolderNode; createdFolderName: string | null } => {
    if (pendingCapture.existingFolderId) {
      return { folderId: pendingCapture.existingFolderId, nextTree: sourceTree, createdFolderName: null };
    }
    if (pendingCapture.newFolderSuggestion) {
      const added = addChildFolder(
        sourceTree,
        pendingCapture.newFolderSuggestion.parentId || 'root',
        pendingCapture.newFolderSuggestion.name
      );
      return { folderId: added.id, nextTree: added.tree, createdFolderName: pendingCapture.newFolderSuggestion.name };
    }
    return { folderId: 'root', nextTree: sourceTree, createdFolderName: null };
  };

  const maybePromptForMatchingNotesFolder = (categoryName: string) => {
    if (findFolderByName(tree, categoryName)) return;
    Alert.alert('Create matching Notes folder?', `Create a matching Notes folder for "${categoryName}"?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        onPress: () => {
          const added = addChildFolder(tree, 'root', categoryName);
          setTree(added.tree);
        },
      },
    ]);
  };

  const ensureTodoCategoryColor = (folderId: string, baseTree = todoTree) => {
    if (folderId === 'root') return;
    const folder = findNode(baseTree, folderId);
    if (!folder || folder.color) return;
    setTodoTree(current => assignCategoryColor(current, folderId, nextCategoryColor(current)));
  };

  const createActionItemsList = (
    sourceFolderId: string,
    items: Array<{ text: string; due: string | null }>,
    sourceNote: EventSourceNote
  ): { listId: string; todoItems: TodoItem[] } => {
    const actionListId = makeId('list');
    const todoItems = items.map(item => ({
      id: makeId('todo'),
      text: item.text,
      due: item.due || null,
      reminderAt: parseSuggestedReminder(item.due),
      notificationId: null,
      eventId: null,
      done: false,
      ts: Date.now(),
      fromNote: sourceNote,
    }));

    setTodoLists(current => [
      {
        id: actionListId,
        title: 'Action Items',
        folderId: sourceFolderId,
        items: todoItems,
        ts: Date.now(),
      },
      ...current,
    ]);

    return { listId: actionListId, todoItems };
  };

  const scheduleReminderIfNeeded = async (listId: string, folderId: string, item: TodoItem) => {
    if (!item.reminderAt) return item;
    const granted = await requestReminderPermissions();
    setSettings(prev => ({ ...prev, notificationsPermissionAsked: true }));
    if (!granted) {
      setError('Notifications are off. Enable them in Android Settings to receive reminders.');
      return item;
    }
    const notificationId = await scheduleTodoReminder('To-do reminder', item.text, item.reminderAt, listId, folderId);
    return { ...item, notificationId };
  };

  const syncLinkedEventForTodo = (listId: string, folderId: string, item: TodoItem): TodoItem => {
    if (!item.reminderAt) {
      if (item.eventId) {
        setCalendarEvents(events => events.filter(event => event.id !== item.eventId));
      }
      return { ...item, eventId: null };
    }

    const eventId = item.eventId || makeId('event');
    setCalendarEvents(events => {
      const existing = events.find(event => event.id === eventId);
      const durationMs = existing ? existing.endAt - existing.startAt : 60 * 60 * 1000;
      const nextEvent: CalendarEvent = {
        id: eventId,
        title: item.text,
        startAt: item.reminderAt,
        endAt: item.reminderAt + durationMs,
        allDay: false,
        done: item.done,
        categoryFolderId: folderId,
        todoListId: listId,
        todoItemId: item.id,
        sourceNote: item.fromNote,
        kind: item.fromNote ? 'action_item' : 'calendar',
        eventType: 'task',
        ts: existing?.ts || Date.now(),
      };
      return existing ? events.map(event => (event.id === eventId ? nextEvent : event)) : [nextEvent, ...events];
    });
    return { ...item, eventId };
  };

  const updateScheduledItem = async (
    eventId: string,
    newTime: number | null,
    options?: { durationMs?: number; title?: string; eventType?: CalendarEvent['eventType']; done?: boolean }
  ) => {
    const currentEvent = calendarEvents.find(event => event.id === eventId);
    let linkedTodo: { listId: string; folderId: string; itemId: string; text: string; done: boolean } | null = null;
    if (currentEvent?.todoListId && currentEvent.todoItemId) {
      const list = todoLists.find(entry => entry.id === currentEvent.todoListId);
      const item = list?.items.find(entry => entry.id === currentEvent.todoItemId);
      if (list && item) {
        linkedTodo = { listId: list.id, folderId: list.folderId, itemId: item.id, text: item.text, done: item.done };
      }
    }
    if (!linkedTodo) {
      todoLists.some(list => {
        const item = list.items.find(entry => entry.eventId === eventId);
        if (!item) return false;
        linkedTodo = { listId: list.id, folderId: list.folderId, itemId: item.id, text: item.text, done: item.done };
        return true;
      });
    }

    if (linkedTodo) {
      const listId = linkedTodo.listId;
      const folderId = linkedTodo.folderId;
      const itemId = linkedTodo.itemId;
      const text = options?.title || linkedTodo.text;
      const nextTime = newTime ?? currentEvent?.startAt ?? null;
      const nextDone = options?.done ?? linkedTodo.done;
      let notificationId =
        todoLists.find(list => list.id === listId)?.items.find(item => item.id === itemId)?.notificationId || null;
      if (notificationId) {
        await cancelTodoReminder(notificationId);
      }
      notificationId = !nextTime || nextDone || nextTime <= Date.now()
        ? null
        : await scheduleTodoReminder('To-do reminder', text, nextTime, listId, folderId);
      const due = nextTime ? formatReminderLabel(nextTime) : null;
      setTodoLists(lists =>
        lists.map(list =>
          list.id === listId
            ? {
                ...list,
                items: list.items.map(item =>
                  item.id === itemId
                    ? { ...item, text, reminderAt: nextTime, due, notificationId, eventId, done: nextDone }
                    : item
                ),
              }
            : list
        )
      );
    }

    setCalendarEvents(events =>
      events.map(event =>
        event.id === eventId
          ? {
              ...event,
              title: options?.title || event.title,
              startAt: newTime ?? event.startAt,
              endAt: (newTime ?? event.startAt) + (options?.durationMs || (event.endAt - event.startAt)),
              allDay: newTime === null ? event.allDay : false,
              done: options?.done ?? event.done,
              eventType: options?.eventType || event.eventType,
            }
          : event
      )
    );
  };

  const appendCalendarEvents = (
    items: Array<{ title: string; due: string | null; todoItemId?: string | null }>,
    sourceFolderId: string | null,
    sourceNote: EventSourceNote | null,
    listId: string | null
  ) => {
    const nextEvents = items
      .map(item => {
        if (!item.due) return null;
        const parsed = parseNaturalDateTime(item.due, item.due);
        if (!parsed) return null;
        return {
          id: makeId('event'),
          title: item.title,
          startAt: parsed.startAt,
          endAt: parsed.endAt,
          allDay: parsed.allDay,
          done: false,
          categoryFolderId: sourceFolderId,
          todoListId: listId,
          todoItemId: item.todoItemId || null,
          sourceNote,
          kind: sourceNote ? 'action_item' : 'calendar',
          eventType: sourceNote ? 'task' : 'other',
          ts: Date.now(),
        } as CalendarEvent;
      })
      .filter(Boolean) as CalendarEvent[];

    if (nextEvents.length) {
      setCalendarEvents(current => [...nextEvents, ...current]);
    }
  };

  const approvePending = async (overrideFolderId?: string) => {
    if (!pending) return;

    if (pending.contentType === 'calendar_entries') {
      const events = pending.calendarEntries
        .map(entry => {
          const parsed = parseNaturalDateTime(entry.date, entry.time);
          return parsed ? withDuration(parsed, entry.durationMinutes) : null;
        })
        .map((parsed, index) =>
          parsed
            ? ({
                id: makeId('event'),
                title: pending.calendarEntries[index].title,
                startAt: parsed.startAt,
                endAt: parsed.endAt,
                allDay: parsed.allDay,
                done: false,
                categoryFolderId: null,
                todoListId: null,
                todoItemId: null,
                sourceNote: null,
                kind: 'calendar',
                eventType: pending.calendarEntries[index].eventType || 'other',
                ts: Date.now(),
              } as CalendarEvent)
            : null
        )
        .filter(Boolean) as CalendarEvent[];

      setCalendarEvents(current => [...events, ...current]);
      setPending(null);
      setTab('schedule');
      return;
    }

    if (pending.contentType === 'todo_items') {
      const folderResolution = overrideFolderId
        ? { folderId: overrideFolderId, nextTree: todoTree, createdFolderName: null as string | null }
        : resolveFolderInTree(todoTree, pending);

      if (folderResolution.nextTree !== todoTree) setTodoTree(folderResolution.nextTree);
      ensureTodoCategoryColor(folderResolution.folderId, folderResolution.nextTree);

      const createdItems: TodoItem[] = pending.todoItems.map(item => ({
        id: makeId('todo'),
        text: item.text,
        due: item.due || null,
        reminderAt: parseSuggestedReminder(item.due),
        notificationId: null,
        eventId: null,
        done: false,
        ts: Date.now(),
        fromNote: null,
      }));

      const nextListId =
        pending.existingTodoListId && todoLists.some(list => list.id === pending.existingTodoListId)
          ? pending.existingTodoListId
          : makeId('list');

      setTodoLists(lists => {
        if (pending.existingTodoListId && lists.some(list => list.id === pending.existingTodoListId)) {
          return lists.map(list => (list.id === pending.existingTodoListId ? { ...list, items: [...list.items, ...createdItems] } : list));
        }
        return [
          {
            id: nextListId,
            title: pending.newTodoListTitle || pending.title || 'To-do list',
            folderId: folderResolution.folderId,
            items: createdItems,
            ts: Date.now(),
          },
          ...lists,
        ];
      });

      const finalListId = nextListId;
      Promise.all(createdItems.map(item => scheduleReminderIfNeeded(finalListId, folderResolution.folderId, item))).then(
        scheduledItems => {
          const linkedItems = scheduledItems.map(item => syncLinkedEventForTodo(finalListId, folderResolution.folderId, item));
          setTodoLists(lists =>
            lists.map(list => (list.id === finalListId ? { ...list, items: linkedItems } : list))
          );
        }
      );

      if (folderResolution.createdFolderName) maybePromptForMatchingNotesFolder(folderResolution.createdFolderName);
      setTodoFocusFolderId(folderResolution.folderId);
      setTodoFocusListId(nextListId);
      setPending(null);
      setTab('todos');
      return;
    }

    const folderResolution = overrideFolderId
      ? { folderId: overrideFolderId, nextTree: tree, createdFolderName: null as string | null }
      : resolveFolderInTree(tree, pending);

    if (folderResolution.nextTree !== tree) setTree(folderResolution.nextTree);

    const noteId = pending.id;
    const note: Note = {
      id: noteId,
      title: pending.title,
      summary: pending.summary,
      transcript: pending.transcript,
      folderId: folderResolution.folderId,
      ts: Date.now(),
      callMode,
      actionItems: pending.actionItems.map(a => ({ text: a.text, due: a.due || null, done: false })),
    };

    setNotes(current => [note, ...current]);

    if (pending.actionItems.length > 0) {
      const sourceNote = { noteId, noteTitle: pending.title };
      const actionList = createActionItemsList(
        folderResolution.folderId,
        pending.actionItems.map(item => ({ text: item.text, due: item.due })),
        sourceNote
      );
      const scheduledItems = await Promise.all(
        actionList.todoItems.map(item => scheduleReminderIfNeeded(actionList.listId, folderResolution.folderId, item))
      );
      const linkedItems = scheduledItems.map(item => syncLinkedEventForTodo(actionList.listId, folderResolution.folderId, item));
      setTodoLists(current =>
        current.map(list => (list.id === actionList.listId ? { ...list, items: linkedItems } : list))
      );
    }

    setPending(null);
    setTab('notes');
  };

  const discardPending = () => setPending(null);

  const toggleTodoItem = async (listId: string, itemId: string) => {
    const list = todoLists.find(entry => entry.id === listId);
    const currentItem = list?.items.find(item => item.id === itemId);
    if (!list || !currentItem) return;
    const nextDone = !currentItem.done;
    if (currentItem.eventId) {
      await updateScheduledItem(currentItem.eventId, currentItem.reminderAt, { done: nextDone });
      return;
    }

    let nextNotificationId = currentItem.notificationId;
    if (nextDone && nextNotificationId) {
      await cancelTodoReminder(nextNotificationId);
      nextNotificationId = null;
    } else if (!nextDone && currentItem.reminderAt && currentItem.reminderAt > Date.now()) {
      nextNotificationId = await scheduleTodoReminder('To-do reminder', currentItem.text, currentItem.reminderAt, listId, list.folderId);
    }
    setTodoLists(lists =>
      lists.map(list =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map(item =>
                item.id === itemId ? { ...item, done: nextDone, notificationId: nextNotificationId } : item
              ),
            }
          : list
      )
    );
  };

  const toggleCalendarEventDone = async (eventId: string) => {
    const event = calendarEvents.find(entry => entry.id === eventId);
    if (!event) return;
    await updateScheduledItem(eventId, event.startAt, { done: !event.done });
  };

  const findTodoForEvent = (eventId: string) => {
    const event = calendarEvents.find(entry => entry.id === eventId);
    if (event?.todoListId && event.todoItemId) {
      const list = todoLists.find(entry => entry.id === event.todoListId);
      const item = list?.items.find(entry => entry.id === event.todoItemId);
      if (list && item) return { list, item };
    }
    for (const list of todoLists) {
      const item = list.items.find(entry => entry.eventId === eventId);
      if (item) return { list, item };
    }
    return null;
  };

  const deleteCalendarEvent = async (eventId: string, deleteTodo: boolean) => {
    const linked = findTodoForEvent(eventId);
    const notificationId = linked?.item.notificationId || null;
    if (notificationId) await cancelTodoReminder(notificationId);

    setCalendarEvents(events => events.filter(event => event.id !== eventId));

    if (linked) {
      setTodoLists(lists =>
        lists.map(list =>
          list.id === linked.list.id
            ? {
                ...list,
                items: deleteTodo
                  ? list.items.filter(item => item.id !== linked.item.id)
                  : list.items.map(item =>
                      item.id === linked.item.id
                        ? { ...item, reminderAt: null, due: null, notificationId: null, eventId: null }
                        : item
                    ),
              }
            : list
        )
      );
    }
  };

  const openLinkedTodoFromEvent = (eventId: string) => {
    const linked = findTodoForEvent(eventId);
    if (!linked) return;
    setFlow('idle');
    setTab('todos');
    setTodoFocusFolderId(linked.list.folderId);
    setTodoFocusListId(linked.list.id);
  };

  const renameTodoList = (listId: string, title: string) => {
    setTodoLists(lists => lists.map(list => (list.id === listId ? { ...list, title } : list)));
  };

  const renameTodoCategory = (folderId: string, name: string) => {
    setTodoTree(current => renameFolder(current, folderId, name));
  };

  const changeTodoCategoryColor = (folderId: string, color: string) => {
    setTodoTree(current => assignCategoryColor(current, folderId, color));
  };

  const changeKeeperCategoryColor = (folderId: string, color: string) => {
    setKeeperTree(current => assignCategoryColor(current, folderId, color));
  };

  const updateTodoItemText = async (listId: string, itemId: string, text: string) => {
    const list = todoLists.find(entry => entry.id === listId);
    const item = list?.items.find(entry => entry.id === itemId);
    if (!list || !item) return;
    let notificationId = item.notificationId;
    if (item.reminderAt && !item.done) {
      if (notificationId) await cancelTodoReminder(notificationId);
      notificationId = await scheduleTodoReminder('To-do reminder', text, item.reminderAt, listId, list.folderId);
    }
    setTodoLists(lists =>
      lists.map(entry =>
        entry.id === listId
          ? {
              ...entry,
              items: entry.items.map(todo =>
                todo.id === itemId
                  ? syncLinkedEventForTodo(listId, list.folderId, { ...todo, text, notificationId })
                  : todo
              ),
            }
          : entry
      )
    );
  };

  const deleteTodoItem = async (listId: string, itemId: string) => {
    const item = todoLists.find(list => list.id === listId)?.items.find(todo => todo.id === itemId);
    if (item?.notificationId) await cancelTodoReminder(item.notificationId);
    setTodoLists(lists =>
      lists.map(list => (list.id === listId ? { ...list, items: list.items.filter(todo => todo.id !== itemId) } : list))
    );
    setCalendarEvents(events => events.filter(event => event.todoItemId !== itemId));
  };

  const deleteTodoList = async (listId: string) => {
    const list = todoLists.find(entry => entry.id === listId);
    if (!list) return;
    await Promise.all(
      list.items
        .map(item => item.notificationId)
        .filter((notificationId): notificationId is string => !!notificationId)
        .map(notificationId => cancelTodoReminder(notificationId))
    );
    setTodoLists(lists => lists.filter(entry => entry.id !== listId));
    setCalendarEvents(events => events.filter(event => event.todoListId !== listId));
    if (todoFocusListId === listId) {
      setTodoFocusListId(null);
      setToastMessage('List deleted.');
    }

    const siblingCount = todoLists.filter(entry => entry.folderId === list.folderId && entry.id !== listId).length;
    const parentFolder = findNode(todoTree, list.folderId);
    if (parentFolder && parentFolder.id !== 'root' && siblingCount === 0 && parentFolder.children.length === 0) {
      Alert.alert(
        'Delete empty category too?',
        `Category "${parentFolder.name}" is now empty. Delete it too?`,
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes', style: 'destructive', onPress: () => deleteTodoCategory(parentFolder.id) },
        ]
      );
    }
  };

  const deleteTodoCategory = async (folderId: string) => {
    const folder = findNode(todoTree, folderId);
    if (!folder) return;
    const descendantIds = collectFolderIds(folder);
    const listsToDelete = todoLists.filter(list => descendantIds.has(list.folderId));
    await Promise.all(
      listsToDelete.flatMap(list =>
        list.items
          .map(item => item.notificationId)
          .filter((notificationId): notificationId is string => !!notificationId)
          .map(notificationId => cancelTodoReminder(notificationId))
      )
    );
    setTodoTree(current => deleteFolder(current, folderId));
    setTodoLists(lists => lists.filter(list => !descendantIds.has(list.folderId)));
    setCalendarEvents(events =>
      events.filter(
        event =>
          !descendantIds.has(event.categoryFolderId || '') &&
          !listsToDelete.some(list => list.id === event.todoListId)
      )
    );
    if (todoFocusFolderId && descendantIds.has(todoFocusFolderId)) {
      setTodoFocusFolderId(null);
      setToastMessage('Category deleted.');
    }
    if (todoFocusListId && listsToDelete.some(list => list.id === todoFocusListId)) {
      setTodoFocusListId(null);
      setToastMessage('List deleted.');
    }
  };

  const addTodoList = (folderId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const list: TodoList = { id: makeId('list'), title: trimmed, folderId, items: [], ts: Date.now() };
    setTodoLists(lists => [...lists, list]);
  };

  const addTodoCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setTodoTree(current => addChildFolder(current, 'root', trimmed).tree);
  };

  const addManualTodoItem = (listId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const item: TodoItem = {
      id: makeId('todo'),
      text: trimmed,
      due: null,
      reminderAt: null,
      notificationId: null,
      eventId: null,
      done: false,
      ts: Date.now(),
      fromNote: null,
    };
    setTodoLists(lists => lists.map(list => (list.id === listId ? { ...list, items: [...list.items, item] } : list)));
  };

  const updateTodoReminder = async (target: ReminderQueueItem, reminderAt: number | null) => {
    const list = todoLists.find(entry => entry.id === target.listId);
    const item = list?.items.find(entry => entry.id === target.itemId);
    if (!item) {
      setReminderQueue(queue => queue.slice(1));
      return;
    }

    let notificationId = item.notificationId;
    if (notificationId) {
      await cancelTodoReminder(notificationId);
      notificationId = null;
    }

    if (reminderAt && !item.done) {
      const granted = await requestReminderPermissions();
      setSettings(prev => ({ ...prev, notificationsPermissionAsked: true }));
      if (!granted) {
        setError('Notifications are off. Enable them in Android Settings to receive reminders.');
      } else {
        notificationId = await scheduleTodoReminder('To-do reminder', item.text, reminderAt, target.listId, target.folderId);
      }
    }

    const dueLabel = reminderAt ? formatReminderLabel(reminderAt) : null;
    setTodoLists(lists =>
      lists.map(entry =>
        entry.id === target.listId
          ? {
              ...entry,
              items: entry.items.map(todo =>
                todo.id === target.itemId
                  ? syncLinkedEventForTodo(target.listId, target.folderId, {
                      ...todo,
                      reminderAt,
                      notificationId,
                      due: dueLabel,
                    })
                  : todo
              ),
            }
          : entry
      )
    );
    setReminderQueue(queue => queue.slice(1));
  };

  const beginReminderEdit = (listId: string, itemId: string) => {
    const list = todoLists.find(entry => entry.id === listId);
    const item = list?.items.find(entry => entry.id === itemId);
    if (!list || !item) return;
    setReminderQueue(queue => [{ listId, itemId, folderId: list.folderId, text: item.text, suggestedDue: item.due }, ...queue]);
  };

  const openSourceNote = (noteId: string) => {
    const note = notes.find(entry => entry.id === noteId);
    if (!note) return;
    const folder = findNode(tree, note.folderId);
    setOpenFolder(folder);
    setTab('notes');
  };

  const renameNoteFolder = (folderId: string, name: string) => {
    setTree(current => renameFolder(current, folderId, name));
  };

  const deleteNoteFolder = (folderId: string) => {
    const target = findNode(tree, folderId);
    if (!target) return;
    const folderIds = collectFolderIds(target);
    const ensured = ensureFolder(tree, 'Miscellaneous');
    const nextTree = deleteFolder(ensured.tree, folderId);
    setTree(nextTree);
    setNotes(current =>
      current.map(note => (folderIds.has(note.folderId) ? { ...note, folderId: ensured.id } : note))
    );
    if (openFolder && folderIds.has(openFolder.id)) {
      setOpenFolder(null);
      setToastMessage('Category deleted.');
    }
  };

  const renameKeeperCategory = (folderId: string, name: string) => {
    setKeeperTree(current => renameFolder(current, folderId, name));
  };

  const deleteKeeperCategory = (folderId: string) => {
    const target = findNode(keeperTree, folderId);
    if (!target) return;
    const descendantIds = collectFolderIds(target);
    const uncategorized = ensureFolder(keeperTree, 'Uncategorized', 'keeper-root');
    const nextTree = deleteFolder(uncategorized.tree, folderId);
    setKeeperTree(nextTree);
    setKeeperItems(current =>
      current.map(item => (descendantIds.has(item.categoryId) ? { ...item, categoryId: uncategorized.id } : item))
    );
  };

  const currentReminder = reminderQueue[0] || null;
  const currentReminderTimestamp = currentReminder
    ? todoLists.find(list => list.id === currentReminder.listId)?.items.find(item => item.id === currentReminder.itemId)?.reminderAt ||
      parseSuggestedReminder(currentReminder.suggestedDue) ||
      (() => {
        const now = new Date();
        now.setDate(now.getDate() + 1);
        now.setHours(9, 0, 0, 0);
        return now.getTime();
      })()
    : Date.now();

  const reviewTree = pending?.contentType === 'todo_items' ? todoTree : tree;
  const showFloatingMic = flow === 'idle' && !pending;

  let screen: React.ReactNode;
  if (flow === 'recording') {
    screen = (
      <RecordingScreen
        callMode={callMode}
        target={captureTarget === 'keeper' ? 'keeper' : 'note'}
        onBeginProcessing={() => setFlow('processing')}
        onError={message => {
          setError(message);
          setFlow('idle');
        }}
        onComplete={handleRecordingComplete}
      />
    );
  } else if (flow === 'processing') {
    screen = <ProcessingScreen />;
  } else if (tab === 'notes') {
    screen = openFolder ? (
        <FolderDetailScreen
          folder={openFolder}
          notes={notes}
          onBack={() => setOpenFolder(null)}
          onOpenFolder={setOpenFolder}
          onRenameFolder={renameNoteFolder}
          onDeleteFolder={deleteNoteFolder}
        />
      ) : (
        <FoldersScreen
        tree={tree}
        notes={notes}
        onOpenFolder={setOpenFolder}
        onAddFolder={name => {
          const { tree: newTree } = addChildFolder(tree, 'root', name);
          setTree(newTree);
        }}
        onRenameFolder={renameNoteFolder}
        onDeleteFolder={deleteNoteFolder}
      />
    );
  } else if (tab === 'keeper') {
    screen = (
      <KeeperScreen
        keeperTree={keeperTree}
        items={keeperItems}
        processing={keeperProcessing}
        error={error}
        onDeleteItem={itemId => setKeeperItems(items => items.filter(item => item.id !== itemId))}
        onUpdateItem={(id, updates) => setKeeperItems(items => items.map(item => item.id === id ? { ...item, ...updates } : item))}
        onAddText={text => saveKeeperItem(text, null)}
        onRecord={startKeeperRecording}
        onRenameCategory={renameKeeperCategory}
        onDeleteCategory={deleteKeeperCategory}
        onChangeCategoryColor={changeKeeperCategoryColor}
        onAddCategory={name => {
          const added = addChildFolder(keeperTree, 'keeper-root', name, 'k');
          setKeeperTree(added.tree);
          return added.id;
        }}
      />
    );
  } else if (tab === 'todos') {
    screen = (
      <ToDosScreen
        tree={todoTree}
        todoLists={todoLists}
        focusedFolderId={todoFocusFolderId}
        focusedListId={todoFocusListId}
        expandState={todoExpandState}
        onExpandStateChange={setTodoExpandState}
        onToggle={toggleTodoItem}
        onAddItem={addManualTodoItem}
        onEditReminder={beginReminderEdit}
        onRenameList={renameTodoList}
        onEditItem={updateTodoItemText}
        onDeleteItem={deleteTodoItem}
        onOpenSourceNote={openSourceNote}
        onDeleteList={deleteTodoList}
        onDeleteCategory={deleteTodoCategory}
        onRenameCategory={renameTodoCategory}
        onChangeCategoryColor={changeTodoCategoryColor}
        onAddList={addTodoList}
        onAddCategory={addTodoCategory}
      />
    );
  } else if (tab === 'settings') {
    screen = <SettingsScreen settings={settings} onSave={setSettings} />;
  } else {
    screen = (
      <CalendarScreen
        todoTree={todoTree}
        todoLists={todoLists}
        events={calendarEvents}
        onOpenEvent={() => {}}
        onToggleEventDone={toggleCalendarEventDone}
        onDeleteEvent={eventId => deleteCalendarEvent(eventId, false)}
        onDeleteEventAndTodo={eventId => deleteCalendarEvent(eventId, true)}
        onOpenLinkedTodo={openLinkedTodoFromEvent}
        onRescheduleEvent={(eventId, startAt, endAt, allDay) => {
          console.log('[CalendarDrag] updateScheduledItem input', {
            eventId,
            startAt,
            endAt,
            allDay,
            nextTime: `${formatClockTime(startAt)} - ${formatClockTime(endAt)}`,
          });
          updateScheduledItem(eventId, startAt, { durationMs: endAt - startAt });
        }}
        onUpdateEvent={(eventId, title, startAt, endAt, eventType) => {
          updateScheduledItem(eventId, startAt, { title, durationMs: endAt - startAt, eventType });
        }}
      />
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <View style={styles.inner}>
          {screen}
          {toastMessage ? (
            <View pointerEvents="none" style={styles.toast}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          ) : null}
          {flow === 'idle' ? (
            <TabBar
              active={tab}
              onChange={nextTab => {
                setTab(nextTab as Tab);
                setOpenFolder(null);
              }}
            />
          ) : null}
          {showFloatingMic ? (
            <TouchableOpacity
              style={[styles.fab, styles.fabRight]}
              onPress={openRecordingChooser}
              activeOpacity={0.88}
            >
              <MaterialCommunityIcons name="microphone" size={26} color="#fff7f1" />
            </TouchableOpacity>
          ) : null}
        </View>
        {currentReminder ? (
          <TodoReminderModal
            visible
            itemText={currentReminder.text}
            initialTimestamp={currentReminderTimestamp}
            suggestedLabel={currentReminder.suggestedDue}
            onSkip={() => updateTodoReminder(currentReminder, null)}
            onSave={timestamp => updateTodoReminder(currentReminder, timestamp)}
          />
        ) : null}
        <Modal
          visible={recordModeSheetOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setRecordModeSheetOpen(false)}
        >
          <View style={styles.sheetScrim}>
            <TouchableOpacity
              style={styles.sheetDismissArea}
              activeOpacity={1}
              onPress={() => setRecordModeSheetOpen(false)}
            />
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Choose a recording type</Text>
              <TouchableOpacity
                style={styles.sheetOption}
                onPress={() => {
                  setRecordModeSheetOpen(false);
                  startQuickCapture();
                }}
                activeOpacity={0.86}
              >
                <Text style={styles.sheetOptionTitle}>Quick note / To-do</Text>
                <Text style={styles.sheetOptionText}>
                  Short capture for a note, checklist, or quick thought.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetOption}
                onPress={startMeetingCapture}
                activeOpacity={0.86}
              >
                <Text style={styles.sheetOptionTitle}>Record a meeting</Text>
                <Text style={styles.sheetOptionText}>
                  Longer recording with transcript, summary, and action items. It keeps recording if you switch apps.
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
      <Modal
        visible={!!pending}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => {}}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            height: '88%',
            backgroundColor: '#f6f1e3',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
          }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#ddd2b3' }}>
              <Text style={{ fontSize: 11, letterSpacing: 2, color: '#8a7d63', textAlign: 'center' }}>REVIEW</Text>
              <Text style={{ fontSize: 26, fontWeight: '700', color: '#3a2e1f', textAlign: 'center', marginTop: 4 }}>
                {pending?.contentType === 'todo_items' ? 'New to-dos' :
                 pending?.contentType === 'calendar_entries' ? 'New events' : 'New note'}
              </Text>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
              showsVerticalScrollIndicator={true}
              bounces={true}
            >
              <ReviewContent pending={pending} tree={reviewTree} todoLists={todoLists} />
            </ScrollView>

            <View style={{
              flexDirection: 'row',
              padding: 16,
              paddingBottom: 32,
              gap: 12,
              borderTopWidth: 1,
              borderTopColor: '#ddd2b3',
              backgroundColor: '#f6f1e3',
            }}>
              <TouchableOpacity
                onPress={discardPending}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 30,
                  borderWidth: 1,
                  borderColor: '#ddd2b3',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, color: '#8a7d63' }}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => approvePending()}
                style={{
                  flex: 2,
                  paddingVertical: 16,
                  borderRadius: 30,
                  backgroundColor: '#3a2e1f',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, color: '#f6f1e3', fontWeight: '600' }}>
                  {pending?.contentType === 'todo_items' ? 'Add tasks' :
                   pending?.contentType === 'calendar_entries' ? 'Add to calendar' : 'Approve'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  inner: { flex: 1 },
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(45, 36, 29, 0.28)',
    justifyContent: 'flex-end',
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
    gap: 12,
  },
  sheetTitle: {
    color: COLORS.brown,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sheetOption: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 18,
    padding: 16,
  },
  sheetOptionTitle: {
    color: COLORS.brown,
    fontSize: FONTS.size.lg,
    fontWeight: '700',
  },
  sheetOptionText: {
    color: COLORS.brownLight,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
    marginTop: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 76,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 20,
  },
  fabRight: {
    right: 18,
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 86,
    backgroundColor: 'rgba(58, 46, 31, 0.92)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 40,
    elevation: 8,
  },
  toastText: {
    color: '#fff7f1',
    textAlign: 'center',
    fontSize: FONTS.size.sm,
    fontWeight: '600',
  },
  reviewBody: {
    gap: 12,
  },
  reviewSummaryCard: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: '#ddd2b3',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3a2e1f',
    lineHeight: 26,
  },
  reviewParagraph: {
    fontSize: 14,
    color: '#5f503b',
    lineHeight: 21,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: '#ddd2b3',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  reviewBullet: {
    color: '#3a2e1f',
    fontSize: 22,
    lineHeight: 24,
    width: 18,
    textAlign: 'center',
  },
  reviewRowText: {
    flex: 1,
    gap: 4,
  },
  reviewItemTitle: {
    fontSize: 15,
    color: '#3a2e1f',
    fontWeight: '700',
    lineHeight: 21,
  },
  reviewMeta: {
    fontSize: 13,
    color: '#8a7d63',
    lineHeight: 19,
  },
  reviewEmptyText: {
    fontSize: 15,
    color: '#8a7d63',
    lineHeight: 22,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
