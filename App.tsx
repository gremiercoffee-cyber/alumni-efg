import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  StyleSheet,
  Platform,
  StatusBar,
  Linking,
  TouchableOpacity,
  Text,
} from 'react-native';
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
import { loadAppState, saveAppState } from './src/storage';
import { classifyKeeperItem, classifyNote } from './src/lib/classify';
import { transcribeAudio } from './src/lib/transcribe';
import {
  addChildFolder,
  classifyDueBucket,
  extractFirstUrl,
  flattenFolders,
  makeId,
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

function sharedTextFromUrl(url: string): string | null {
  const match = url.match(/[?&]text=([^&]+)/);
  return match ? decodeURIComponent(match[1].replace(/\+/g, '%20')) : null;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [flow, setFlow] = useState<Flow>('idle');
  const [callMode, setCallMode] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget>('general');
  const [tree, setTree] = useState<FolderNode>(EMPTY_TREE);
  const [keeperTree, setKeeperTree] = useState<FolderNode>(EMPTY_KEEPER_TREE);
  const [notes, setNotes] = useState<Note[]>([]);
  const [keeperItems, setKeeperItems] = useState<KeeperItem[]>([]);
  const [todoLists, setTodoLists] = useState<TodoList[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    openaiKey: '',
    anthropicKey: '',
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
  const handledShareUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadAppState().then(s => {
      if (s) {
        if (s.tree) setTree(s.tree);
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
    saveAppState({ tree, keeperTree, notes, keeperItems, todoLists, settings });
  }, [tree, keeperTree, notes, keeperItems, todoLists, settings, loaded]);

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

  const handleSharedText = async (sharedText: string) => {
    const url = extractFirstUrl(sharedText);
    await saveKeeperItem(sharedText, url || null);
  };

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (handledShareUrls.current.has(url)) return;
      handledShareUrls.current.add(url);
      const sharedText = sharedTextFromUrl(url);
      if (sharedText) {
        handleSharedText(sharedText);
      }
    };

    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, [keeperTree, settings.openaiKey]);

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
    console.error('Recording stop failed', message);
    setError(message);
    setFlow('idle');
  };

  const handleRecordingComplete = async (audioUri: string) => {
    console.log('Recording complete, starting transcription', audioUri);
    try {
      if (!settings.openaiKey) throw new Error('No OpenAI key - add it in Settings first.');
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
      setFlow('review');
    } catch (e: any) {
      console.error('Recording processing failed', e);
      setError(e.message || 'Something went wrong. Check your API keys in Settings.');
      setFlow('idle');
    } finally {
      setCaptureTarget('general');
    }
  };

  const resolveFolder = (
    pendingCapture: PendingCapture
  ): { folderId: string; nextTree: FolderNode } => {
    if (pendingCapture.existingFolderId) {
      return { folderId: pendingCapture.existingFolderId, nextTree: tree };
    }

    if (pendingCapture.newFolderSuggestion) {
      const added = addChildFolder(
        tree,
        pendingCapture.newFolderSuggestion.parentId || 'root',
        pendingCapture.newFolderSuggestion.name
      );
      return { folderId: added.id, nextTree: added.tree };
    }

    return { folderId: 'root', nextTree: tree };
  };

  const approvePending = (overrideFolderId?: string) => {
    if (!pending) return;
    const { folderId, nextTree } = overrideFolderId
      ? { folderId: overrideFolderId, nextTree: tree }
      : resolveFolder(pending);

    if (nextTree !== tree) setTree(nextTree);

    if (pending.contentType === 'todo_items') {
      const newItems: TodoItem[] = pending.todoItems.map(item => ({
        id: makeId('todo'),
        text: item.text,
        due: item.due || null,
        done: false,
        ts: Date.now(),
      }));

      setTodoLists(lists => {
        const existingId = pending.existingTodoListId;
        if (existingId && lists.some(list => list.id === existingId && list.folderId === folderId)) {
          return lists.map(list =>
            list.id === existingId
              ? { ...list, items: [...list.items, ...newItems] }
              : list
          );
        }

        const newList: TodoList = {
          id: makeId('list'),
          title: pending.newTodoListTitle || pending.title || 'To-do list',
          folderId,
          items: newItems,
          ts: Date.now(),
        };
        return [newList, ...lists];
      });

      setPending(null);
      setFlow('idle');
      setTab('todos');
      return;
    }

    const note: Note = {
      id: pending.id,
      title: pending.title,
      summary: pending.summary,
      transcript: pending.transcript,
      folderId,
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

  const showTabBar = flow === 'idle' || flow === 'toast';

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
        tree={tree}
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
      />
    ) : (
      <FoldersScreen
        tree={tree}
        notes={notes}
        onOpenFolder={setOpenFolder}
        onAddFolder={(name) => {
          const { tree: newTree } = addChildFolder(tree, 'root', name);
          setTree(newTree);
        }}
      />
    );
  } else if (tab === 'keeper') {
    screen = (
      <KeeperScreen
        keeperTree={keeperTree}
        items={keeperItems}
        processing={keeperProcessing}
        error={error}
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
        tree={tree}
        todoLists={todoLists}
        onToggle={toggleTodoItem}
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
              <Text style={styles.scheduleHandleText}>Plan</Text>
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
