import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import RecordingScreen from './src/screens/RecordingScreen';
import CallPromptScreen from './src/screens/CallPromptScreen';
import ProcessingScreen from './src/screens/ProcessingScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import FoldersScreen from './src/screens/FoldersScreen';
import FolderDetailScreen from './src/screens/FolderDetailScreen';
import ActionsScreen from './src/screens/ActionsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TabBar from './src/components/TabBar';
import { loadAppState, saveAppState } from './src/storage';
import { classifyNote } from './src/lib/classify';
import { transcribeAudio } from './src/lib/transcribe';
import { addChildFolder, flattenFolders } from './src/utils';
import { SEED_TREE, COLORS } from './src/constants';
import type { FolderNode, Note, PendingNote, AppSettings } from './src/types';

export type Tab = 'home' | 'folders' | 'actions' | 'settings';
export type Flow = 'idle' | 'callPrompt' | 'recording' | 'processing' | 'toast' | 'review';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [flow, setFlow] = useState<Flow>('idle');
  const [callMode, setCallMode] = useState(false);
  const [tree, setTree] = useState<FolderNode>(SEED_TREE);
  const [notes, setNotes] = useState<Note[]>([]);
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
  const [pending, setPending] = useState<PendingNote | null>(null);
  const [openFolder, setOpenFolder] = useState<FolderNode | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load persisted state on start
  useEffect(() => {
    loadAppState().then(s => {
      if (s) {
        if (s.tree) setTree(s.tree);
        if (s.notes) setNotes(s.notes);
        if (s.settings) setSettings(prev => ({ ...prev, ...s.settings }));
      }
      setLoaded(true);
    });
  }, []);

  // Persist whenever state changes
  useEffect(() => {
    if (!loaded) return;
    saveAppState({ tree, notes, settings });
  }, [tree, notes, settings, loaded]);

  // ---- recording flow ----
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

  const handleRecordingComplete = async (audioUri: string) => {
    setFlow('processing');
    try {
if (!settings.openaiKey) throw new Error('No OpenAI key — add it in Settings first.');
      const transcript = await transcribeAudio(audioUri, settings.openaiKey);
      const folderList = flattenFolders(tree);
      const classification = await classifyNote({
        transcript,
        folderList,
        settings,
        openaiKey: settings.openaiKey,
      });
      setPending({ ...classification, transcript, id: 'n-' + Date.now() });
      setFlow('toast');
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Check your API keys in Settings.');
      setFlow('idle');
    }
  };

  // ---- approving / discarding the pending note ----
  const approvePending = (overrideFolderId?: string) => {
    if (!pending) return;
    let targetFolderId = overrideFolderId;

    if (!targetFolderId) {
      if (pending.existingFolderId) {
        targetFolderId = pending.existingFolderId;
      } else if (pending.newFolderSuggestion) {
        const { tree: newTree, id } = addChildFolder(
          tree,
          pending.newFolderSuggestion.parentId || 'root',
          pending.newFolderSuggestion.name
        );
        setTree(newTree);
        targetFolderId = id;
      } else {
        targetFolderId = 'f-misc';
      }
    }

    const note: Note = {
      id: pending.id,
      title: pending.title,
      summary: pending.summary,
      transcript: pending.transcript,
      folderId: targetFolderId!,
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

  // ---- render ----
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
        notes={notes}
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
  } else if (tab === 'actions') {
    screen = (
      <ActionsScreen
        notes={notes}
        tree={tree}
        onToggle={toggleActionItem}
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
