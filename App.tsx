import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  StyleSheet,
  Platform,
  StatusBar,
  Linking,
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
import { loadAppState, saveAppState } from './src/storage';
import { classifyLink, classifyNote } from './src/lib/classify';
import { transcribeAudio } from './src/lib/transcribe';
import { addChildFolder, extractFirstUrl, flattenFolders, makeId } from './src/utils';
import { EMPTY_KEEPER_TREE, EMPTY_TREE, COLORS } from './src/constants';
import type {
  FolderNode,
  Note,
  PendingCapture,
  AppSettings,
  SavedLink,
  TodoList,
  TodoItem,
} from './src/types';

export type Tab = 'home' | 'folders' | 'keeper' | 'actions' | 'todos' | 'settings';
export type Flow = 'idle' | 'callPrompt' | 'recording' | 'processing' | 'toast' | 'review';

function sharedTextFromUrl(url: string): string | null {
  const match = url.match(/[?&]text=([^&]+)/);
  return match ? decodeURIComponent(match[1].replace(/\+/g, '%20')) : null;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [flow, setFlow] = useState<Flow>('idle');
  const [callMode, setCallMode] = useState(false);
  const [tree, setTree] = useState<FolderNode>(EMPTY_TREE);
  const [keeperTree, setKeeperTree] = useState<FolderNode>(EMPTY_KEEPER_TREE);
  const [notes, setNotes] = useState<Note[]>([]);
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([]);
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
  const handledShareUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadAppState().then(s => {
      if (s) {
        if (s.tree) setTree(s.tree);
        if (s.keeperTree) setKeeperTree(s.keeperTree);
        if (s.notes) setNotes(s.notes);
        if (s.savedLinks) setSavedLinks(s.savedLinks);
        if (s.todoLists) setTodoLists(s.todoLists);
        if (s.settings) setSettings(prev => ({ ...prev, ...s.settings }));
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveAppState({ tree, keeperTree, notes, savedLinks, todoLists, settings });
  }, [tree, keeperTree, notes, savedLinks, todoLists, settings, loaded]);

  const handleSharedText = async (sharedText: string) => {
    const url = extractFirstUrl(sharedText);
    setFlow('idle');
    setTab('keeper');
    setError(null);

    if (!url) {
      setError('Shared text did not include a link.');
      return;
    }

    if (!settings.openaiKey) {
      setError('No OpenAI key - add it in Settings first.');
      return;
    }

    setKeeperProcessing(true);
    try {
      const classification = await classifyLink({
        sharedText,
        url,
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

      const link: SavedLink = {
        id: makeId('link'),
        url,
        title: classification.title || url,
        summary: classification.summary || sharedText,
        categoryId: categoryId || 'keeper-root',
        ts: Date.now(),
      };

      setKeeperTree(nextKeeperTree);
      setSavedLinks(items => [link, ...items]);
    } catch (e: any) {
      console.error('Shared link processing failed', e);
      setError(e.message || 'Could not save shared link.');
    } finally {
      setKeeperProcessing(false);
    }
  };

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (handledShareUrls.current.has(url)) return;
      handledShareUrls.current.add(url);
      const sharedText = sharedTextFromUrl(url);
      if (sharedText) handleSharedText(sharedText);
    };

    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, [keeperTree, settings.openaiKey]);

  const startRecording = () => {
    setCallMode(false);
    setError(null);
    setFlow('recording');
  };

  const startCallPrompt = () => {
    setError(null);
    setFlow('callPrompt');
  };

  const confirmCallRecording = () => {
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
      const itemTexts = pending.todoItems || [];
      const newItems: TodoItem[] = itemTexts.map(item => ({
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
      actionItems: (pending.actionItems || []).map(a => ({
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
  } else if (tab === 'folders') {
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
        links={savedLinks}
        processing={keeperProcessing}
        error={error}
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
          <TabBar
            active={tab}
            onChange={t => {
              setFlow('idle');
              setTab(t as Tab);
              setOpenFolder(null);
            }}
          />
        )}
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
});
