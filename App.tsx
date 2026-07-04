import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import RecordingScreen from './src/screens/RecordingScreen';
import ProcessingScreen from './src/screens/ProcessingScreen';
import ReviewScreen from './src/screens/ReviewScreen';
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
    newTime: number,
    options?: { durationMs?: number; title?: string; eventType?: CalendarEvent['eventType'] }
  ) => {
    let linkedTodo: { listId: string; folderId: string; itemId: string; text: string } | null = null;
    todoLists.some(list => {
      const item = list.items.find(entry => entry.eventId === eventId);
      if (!item) return false;
      linkedTodo = { listId: list.id, folderId: list.folderId, itemId: item.id, text: item.text };
      return true;
    });

    if (linkedTodo) {
      const listId = linkedTodo.listId;
      const folderId = linkedTodo.folderId;
      const itemId = linkedTodo.itemId;
      const text = options?.title || linkedTodo.text;
      let notificationId =
        todoLists.find(list => list.id === listId)?.items.find(item => item.id === itemId)?.notificationId || null;
      if (notificationId) {
        await cancelTodoReminder(notificationId);
      }
      notificationId = await scheduleTodoReminder('To-do reminder', text, newTime, listId, folderId);
      const due = formatReminderLabel(newTime);
      setTodoLists(lists =>
        lists.map(list =>
          list.id === listId
            ? {
                ...list,
                items: list.items.map(item =>
                  item.id === itemId
                    ? { ...item, text, reminderAt: newTime, due, notificationId, eventId }
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
              startAt: newTime,
              endAt: newTime + (options?.durationMs || (event.endAt - event.startAt)),
              allDay: false,
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

  const toggleTodoItem = (listId: string, itemId: string) => {
    setTodoLists(lists =>
      lists.map(list =>
        list.id === listId
          ? { ...list, items: list.items.map(item => (item.id === itemId ? { ...item, done: !item.done } : item)) }
          : list
      )
    );
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

  const updateTodoItemText = async (listId: string, itemId: string, text: string) => {
    const list = todoLists.find(entry => entry.id === listId);
    const item = list?.items.find(entry => entry.id === itemId);
    if (!list || !item) return;
    let notificationId = item.notificationId;
    if (item.reminderAt) {
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

    if (reminderAt) {
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
  const placeFabLeft = tab === 'notes';

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
        onAddText={text => saveKeeperItem(text, null)}
        onRecord={startKeeperRecording}
        onRenameCategory={renameKeeperCategory}
        onDeleteCategory={deleteKeeperCategory}
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
      />
    );
  } else if (tab === 'settings') {
    screen = <SettingsScreen settings={settings} onSave={setSettings} />;
  } else {
    screen = (
      <CalendarScreen
        todoTree={todoTree}
        events={calendarEvents}
        onOpenEvent={event => {
          Alert.alert(
            event.title,
            event.allDay ? 'All day' : `${formatClockTime(event.startAt)} - ${formatClockTime(event.endAt)}`,
            [
              { text: 'Close', style: 'cancel' },
              { text: 'Meeting', onPress: () => setCalendarEvents(events => events.map(entry => entry.id === event.id ? { ...entry, eventType: 'meeting' } : entry)) },
              { text: 'Reminder', onPress: () => setCalendarEvents(events => events.map(entry => entry.id === event.id ? { ...entry, eventType: 'reminder' } : entry)) },
              { text: 'Task', onPress: () => setCalendarEvents(events => events.map(entry => entry.id === event.id ? { ...entry, eventType: 'task' } : entry)) },
            ]
          );
        }}
        onRescheduleEvent={(eventId, startAt, endAt, allDay) => {
          updateScheduledItem(eventId, startAt, { durationMs: endAt - startAt });
        }}
      />
    );
  }

  return (
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
            style={[styles.fab, placeFabLeft ? styles.fabLeft : styles.fabRight]}
            onPress={openRecordingChooser}
            activeOpacity={0.88}
          >
            <MaterialCommunityIcons name="microphone" size={26} color="#fff7f1" />
          </TouchableOpacity>
        ) : null}
        {pending
          ? (console.log('Review pending payload', pending),
            (
              <ReviewScreen
                visible
                pending={pending}
                tree={reviewTree}
                todoLists={todoLists}
                onApprove={approvePending}
                onDiscard={discardPending}
              />
            ))
          : null}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  fabLeft: {
    left: 18,
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
});
