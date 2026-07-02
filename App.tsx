import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import HomeScreen from './src/screens/HomeScreen';
import RecordingScreen from './src/screens/RecordingScreen';
import CallPromptScreen from './src/screens/CallPromptScreen';
import ProcessingScreen from './src/screens/ProcessingScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import FoldersScreen from './src/screens/FoldersScreen';
import FolderDetailScreen from './src/screens/FolderDetailScreen';
import ActionsScreen from './src/screens/ActionsScreen';
import KeeperScreen from './src/screens/KeeperScreen';
import ToDosScreen from './src/screens/ToDosScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TabBar from './src/components/TabBar';
import ScheduleDrawer, { ScheduleEntry } from './src/components/ScheduleDrawer';
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
  classifyDueBucket,
  collectFolderIds,
  deleteFolder,
  ensureFolder,
  extractFirstUrl,
  findFolderByName,
  findNode,
  flattenFolders,
  formatReminderLabel,
  makeId,
  parseSuggestedReminder,
  renameFolder,
} from './src/utils';
import { EMPTY_KEEPER_TREE, EMPTY_TREE, COLORS } from './src/constants';
import type {
  FolderNode,
  Note,
  PendingCapture,
  AppSettings,
  KeeperItem,
  TodoList,
  TodoItem,
} from './src/types';

export type Tab = 'home' | 'notes' | 'keeper' | 'actions' | 'todos' | 'settings';
export type Flow = 'idle' | 'callPrompt' | 'recording' | 'processing' | 'toast' | 'review';
type CaptureTarget = 'general' | 'keeper';

interface ReminderQueueItem {
  listId: string;
  itemId: string;
  folderId: string;
  text: string;
  suggestedDue: string | null;
}

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
  const [tab, setTab] = useState<Tab>('home');
  const [flow, setFlow] = useState<Flow>('idle');
  const [callMode, setCallMode] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget>('general');
  const [tree, setTree] = useState<FolderNode>(EMPTY_TREE);
  const [todoTree, setTodoTree] = useState<FolderNode>(EMPTY_TREE);
  const [keeperTree, setKeeperTree] = useState<FolderNode>(EMPTY_KEEPER_TREE);
  const [notes, setNotes] = useState<Note[]>([]);
  const [keeperItems, setKeeperItems] = useState<KeeperItem[]>([]);
  const [todoLists, setTodoLists] = useState<TodoList[]>([]);
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
  const [keeperProcessing, setKeeperProcessing] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [todoFocusFolderId, setTodoFocusFolderId] = useState<string | null>(null);
  const [todoFocusListId, setTodoFocusListId] = useState<string | null>(null);
  const [reminderQueue, setReminderQueue] = useState<ReminderQueueItem[]>([]);
  const handledShareUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!openFolder) return;
    const refreshed = findNode(tree, openFolder.id);
    setOpenFolder(refreshed);
  }, [tree]);

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
        if (s.settings) setSettings(prev => ({ ...prev, ...s.settings }));
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveAppState({ tree, todoTree, keeperTree, notes, keeperItems, todoLists, settings });
  }, [tree, todoTree, keeperTree, notes, keeperItems, todoLists, settings, loaded]);

  useEffect(() => {
    if (!loaded || settings.microphonePermissionAsked) return;
    Audio.requestPermissionsAsync()
      .then(permission => {
        console.log('Initial microphone permission result', permission);
        setSettings(prev => ({ ...prev, microphonePermissionAsked: true }));
      })
      .catch(error => {
        console.warn('Initial microphone permission request failed', error);
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

  const scheduleEntries = useMemo<ScheduleEntry[]>(() => {
    const fromActions = notes.flatMap(note =>
      note.actionItems
        .filter(item => !item.done && item.due)
        .map(item => ({
          id: `${note.id}-${item.text}`,
          title: item.text,
          subtitle: note.title,
          due: item.due || '',
          bucket: classifyDueBucket(item.due) || 'later',
        }))
    );

    const fromTodos = todoLists.flatMap(list =>
      list.items
        .filter(item => !item.done && item.due)
        .map(item => ({
          id: `${list.id}-${item.id}`,
          title: item.text,
          subtitle: list.title,
          due: item.due || '',
          bucket: classifyDueBucket(item.due) || 'later',
        }))
    );

    return [...fromActions, ...fromTodos];
  }, [notes, todoLists]);

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
      setError('No OpenAI key - add it in Settings first.');
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
      console.error('Keeper save failed', e);
      setError(e.message || 'Could not save to Keeper.');
    } finally {
      setKeeperProcessing(false);
      setFlow('idle');
    }
  };

  const deleteKeeperItem = (itemId: string) => {
    setKeeperItems(items => items.filter(item => item.id !== itemId));
  };

  const startRecording = () => {
    setCaptureTarget('general');
    setCallMode(false);
    setError(null);
    setFlow('recording');
  };

  const startKeeperRecording = () => {
    setCaptureTarget('keeper');
    setCallMode(false);
    setError(null);
    setTab('keeper');
    setFlow('recording');
  };

  const startCallPrompt = () => {
    setCaptureTarget('general');
    setError(null);
    setFlow('callPrompt');
  };

  const confirmCallRecording = () => {
    setCaptureTarget('general');
    setCallMode(true);
    setFlow('recording');
  };

  const cancelCallPrompt = () => setFlow('idle');

  const beginProcessing = () => {
    setFlow('processing');
  };

  const handleRecordingError = (message: string) => {
    console.error('Recording flow failed', message);
    setError(message);
    setFlow('idle');
  };

  const handleRecordingComplete = async (audioUri: string) => {
    try {
      if (!settings.openaiKey) throw new Error('No OpenAI key - add it in Settings first.');
      const transcript = await transcribeAudio(audioUri, settings.openaiKey);

      if (captureTarget === 'keeper') {
        await saveKeeperItem(transcript, null);
        return;
      }

      const folderList = flattenFolders(todoTree);
      const classification = await classifyNote({
        transcript,
        folderList,
        todoLists,
        settings,
        openaiKey: settings.openaiKey,
      });
      setPending({ ...classification, transcript, id: makeId('pending') } as PendingCapture);
      setFlow('review');
    } catch (e: any) {
      console.error('Recording processing failed', e);
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
      return {
        folderId: added.id,
        nextTree: added.tree,
        createdFolderName: pendingCapture.newFolderSuggestion.name,
      };
    }

    return { folderId: 'root', nextTree: sourceTree, createdFolderName: null };
  };

  const enqueueReminderPrompts = (items: TodoItem[], listId: string, folderId: string) => {
    const nextQueue = items.map(item => ({
      listId,
      itemId: item.id,
      folderId,
      text: item.text,
      suggestedDue: item.due,
    }));
    setReminderQueue(queue => [...queue, ...nextQueue]);
  };

  const maybePromptForMatchingNotesFolder = (categoryName: string) => {
    if (findFolderByName(tree, categoryName)) return;

    Alert.alert(
      'Create matching Notes folder?',
      `Create a matching Notes folder for "${categoryName}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            const added = addChildFolder(tree, 'root', categoryName);
            setTree(added.tree);
          },
        },
      ]
    );
  };

  const approvePending = (overrideFolderId?: string) => {
    if (!pending) return;

    if (pending.contentType === 'todo_items') {
      const folderResolution = overrideFolderId
        ? { folderId: overrideFolderId, nextTree: todoTree, createdFolderName: null as string | null }
        : resolveFolderInTree(todoTree, pending);

      if (folderResolution.nextTree !== todoTree) {
        setTodoTree(folderResolution.nextTree);
      }

      const newItems: TodoItem[] = pending.todoItems.map(item => ({
        id: makeId('todo'),
        text: item.text,
        due: item.due || null,
        reminderAt: null,
        notificationId: null,
        done: false,
        ts: Date.now(),
      }));

      const nextListId =
        pending.existingTodoListId &&
        todoLists.some(list => list.id === pending.existingTodoListId)
          ? pending.existingTodoListId
          : makeId('list');

      setTodoLists(lists => {
        if (pending.existingTodoListId && lists.some(list => list.id === pending.existingTodoListId)) {
          return lists.map(list =>
            list.id === pending.existingTodoListId
              ? { ...list, items: [...list.items, ...newItems] }
              : list
          );
        }

        const newList: TodoList = {
          id: nextListId,
          title: pending.newTodoListTitle || pending.title || 'To-do list',
          folderId: folderResolution.folderId,
          items: newItems,
          ts: Date.now(),
        };
        return [newList, ...lists];
      });

      enqueueReminderPrompts(newItems, nextListId, folderResolution.folderId);
      if (folderResolution.createdFolderName) {
        maybePromptForMatchingNotesFolder(folderResolution.createdFolderName);
      }
      setTodoFocusFolderId(folderResolution.folderId);
      setTodoFocusListId(nextListId);
      setPending(null);
      setFlow('idle');
      setTab('todos');
      return;
    }

    const folderResolution = overrideFolderId
      ? { folderId: overrideFolderId, nextTree: tree, createdFolderName: null as string | null }
      : resolveFolderInTree(tree, pending);

    if (folderResolution.nextTree !== tree) {
      setTree(folderResolution.nextTree);
    }

    const note: Note = {
      id: pending.id,
      title: pending.title,
      summary: pending.summary,
      transcript: pending.transcript,
      folderId: folderResolution.folderId,
      ts: Date.now(),
      callMode,
      actionItems: pending.actionItems.map(a => ({
        text: a.text,
        due: a.due || null,
        done: false,
      })),
    };

    setNotes(n => [note, ...n]);
    setPending(null);
    setFlow('idle');
    setTab('home');
  };

  const discardPending = () => {
    setPending(null);
    setFlow('idle');
  };

  const toggleActionItem = (noteId: string, idx: number) => {
    setNotes(ns =>
      ns.map(n =>
        n.id === noteId
          ? {
              ...n,
              actionItems: n.actionItems.map((a, i) =>
                i === idx ? { ...a, done: !a.done } : a
              ),
            }
          : n
      )
    );
  };

  const toggleTodoItem = (listId: string, itemId: string) => {
    setTodoLists(lists =>
      lists.map(list =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map(item =>
                item.id === itemId ? { ...item, done: !item.done } : item
              ),
            }
          : list
      )
    );
  };

  const renameTodoList = (listId: string, title: string) => {
    setTodoLists(lists =>
      lists.map(list => (list.id === listId ? { ...list, title } : list))
    );
  };

  const updateTodoItemText = async (listId: string, itemId: string, text: string) => {
    const list = todoLists.find(entry => entry.id === listId);
    const item = list?.items.find(entry => entry.id === itemId);
    if (!list || !item) return;

    let nextNotificationId = item.notificationId;
    if (item.reminderAt) {
      if (nextNotificationId) {
        await cancelTodoReminder(nextNotificationId);
      }
      nextNotificationId = await scheduleTodoReminder(
        'To-do reminder',
        text,
        item.reminderAt,
        listId,
        list.folderId
      );
    }

    setTodoLists(lists =>
      lists.map(entry =>
        entry.id === listId
          ? {
              ...entry,
              items: entry.items.map(todo =>
                todo.id === itemId
                  ? { ...todo, text, notificationId: nextNotificationId }
                  : todo
              ),
            }
          : entry
      )
    );
  };

  const deleteTodoItem = async (listId: string, itemId: string) => {
    const item = todoLists
      .find(list => list.id === listId)
      ?.items.find(todo => todo.id === itemId);
    if (item?.notificationId) {
      await cancelTodoReminder(item.notificationId);
    }
    setTodoLists(lists =>
      lists.map(list =>
        list.id === listId
          ? { ...list, items: list.items.filter(todo => todo.id !== itemId) }
          : list
      )
    );
  };

  const renameNoteFolder = (folderId: string, name: string) => {
    setTree(current => renameFolder(current, folderId, name));
  };

  const deleteNoteFolder = (folderId: string) => {
    const target = findNode(tree, folderId);
    if (!target) return;

    const folderIds = collectFolderIds(target);
    const noteCount = notes.filter(note => folderIds.has(note.folderId)).length;
    const subfolderCount = Math.max(folderIds.size - 1, 0);

    const performDelete = () => {
      const ensured = ensureFolder(tree, 'Miscellaneous');
      const miscId = ensured.id;
      const nextTree = deleteFolder(ensured.tree, folderId);
      setTree(nextTree);
      setNotes(current =>
        current.map(note =>
          folderIds.has(note.folderId) ? { ...note, folderId: miscId } : note
        )
      );
      if (openFolder && folderIds.has(openFolder.id)) {
        setOpenFolder(null);
      }
    };

    if (noteCount === 0 && subfolderCount === 0) {
      Alert.alert('Delete folder?', 'This folder is empty.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
      return;
    }

    Alert.alert(
      'Delete folder?',
      `This folder contains ${noteCount} notes and ${subfolderCount} subfolders. Deleting it will move all contents to Miscellaneous. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]
    );
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
      done: false,
      ts: Date.now(),
    };

    let folderId = 'root';
    setTodoLists(lists =>
      lists.map(list => {
        if (list.id !== listId) return list;
        folderId = list.folderId;
        return { ...list, items: [...list.items, item] };
      })
    );
    enqueueReminderPrompts([item], listId, folderId);
  };

  const updateTodoReminder = async (target: ReminderQueueItem, reminderAt: number | null) => {
    const list = todoLists.find(entry => entry.id === target.listId);
    const item = list?.items.find(entry => entry.id === target.itemId);
    if (!item) {
      setReminderQueue(queue => queue.slice(1));
      return;
    }

    let notificationId: string | null = item.notificationId;
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
        notificationId = await scheduleTodoReminder(
          'To-do reminder',
          item.text,
          reminderAt,
          target.listId,
          target.folderId
        );
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
                  ? {
                      ...todo,
                      reminderAt,
                      notificationId,
                      due: dueLabel,
                    }
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
    setReminderQueue(queue => [
      {
        listId,
        itemId,
        folderId: list.folderId,
        text: item.text,
        suggestedDue: item.due,
      },
      ...queue,
    ]);
  };

  const showTabBar = flow === 'idle' || flow === 'toast';
  const currentReminder = reminderQueue[0] || null;
  const currentReminderTimestamp = currentReminder
    ? todoLists
        .find(list => list.id === currentReminder.listId)
        ?.items.find(item => item.id === currentReminder.itemId)?.reminderAt ||
      parseSuggestedReminder(currentReminder.suggestedDue) ||
      (() => {
        const now = new Date();
        now.setDate(now.getDate() + 1);
        now.setHours(9, 0, 0, 0);
        return now.getTime();
      })()
    : Date.now();

  let screen: React.ReactNode;

  if (flow === 'callPrompt') {
    screen = (
      <CallPromptScreen
        onConfirm={confirmCallRecording}
        onCancel={cancelCallPrompt}
      />
    );
  } else if (flow === 'recording') {
    screen = (
      <RecordingScreen
        callMode={callMode}
        target={captureTarget === 'keeper' ? 'keeper' : 'note'}
        onBeginProcessing={beginProcessing}
        onError={handleRecordingError}
        onComplete={handleRecordingComplete}
      />
    );
  } else if (flow === 'processing') {
    screen = <ProcessingScreen />;
  } else if (flow === 'review') {
    screen = (
      <ReviewScreen
        pending={pending!}
        tree={pending?.contentType === 'todo_items' ? todoTree : tree}
        todoLists={todoLists}
        onApprove={approvePending}
        onDiscard={discardPending}
      />
    );
  } else if (flow === 'toast') {
    screen = (
      <HomeScreen
        notes={notes}
        error={error}
        onRecordTap={startRecording}
        onCallRecordTap={startCallPrompt}
        showToast
        onToastTap={() => setFlow('review')}
      />
    );
  } else if (tab === 'home') {
    screen = (
      <HomeScreen
        notes={notes}
        error={error}
        onRecordTap={startRecording}
        onCallRecordTap={startCallPrompt}
        showToast={false}
      />
    );
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
        onDeleteItem={deleteKeeperItem}
        onAddText={text => {
          saveKeeperItem(text, null);
        }}
        onRecord={startKeeperRecording}
      />
    );
  } else if (tab === 'actions') {
    screen = (
      <ActionsScreen
        notes={notes}
        tree={tree}
        onToggle={toggleActionItem}
      />
    );
  } else if (tab === 'todos') {
    screen = (
      <ToDosScreen
        tree={todoTree}
        todoLists={todoLists}
        focusedFolderId={todoFocusFolderId}
        focusedListId={todoFocusListId}
        onToggle={toggleTodoItem}
        onAddItem={addManualTodoItem}
        onEditReminder={beginReminderEdit}
        onRenameList={renameTodoList}
        onEditItem={updateTodoItemText}
        onDeleteItem={deleteTodoItem}
      />
    );
  } else {
    screen = (
      <SettingsScreen
        settings={settings}
        onSave={setSettings}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <View style={styles.inner}>
        {screen}
        {showTabBar && (
          <>
            <TouchableOpacity
              style={styles.scheduleHandle}
              onPress={() => setScheduleOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.scheduleHandleText}>Schedule</Text>
            </TouchableOpacity>
            <TabBar
              active={tab}
              onChange={t => {
                setFlow('idle');
                setTab(t as Tab);
                setOpenFolder(null);
              }}
            />
          </>
        )}
        <ScheduleDrawer
          visible={scheduleOpen}
          routineText={settings.schedule}
          entries={scheduleEntries}
          onClose={() => setScheduleOpen(false)}
        />
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
  inner: {
    flex: 1,
  },
  scheduleHandle: {
    position: 'absolute',
    right: 0,
    top: '38%',
    zIndex: 20,
    backgroundColor: COLORS.brown,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  scheduleHandleText: {
    color: COLORS.bg,
    fontSize: 12,
    fontWeight: '600',
  },
});
