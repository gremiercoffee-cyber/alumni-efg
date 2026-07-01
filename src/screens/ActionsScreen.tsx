import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import TopBar from '../components/TopBar';
import SpeakButton from '../components/SpeakButton';
import { COLORS, FONTS } from '../constants';
import { flattenFolders, folderPathLabel } from '../utils';
import { FolderNode, Note } from '../types';

interface Props {
  notes: Note[];
  tree: FolderNode;
  onToggle: (noteId: string, idx: number) => void;
}

interface FlatAction {
  noteId: string;
  idx: number;
  text: string;
  due: string | null;
  done: boolean;
  noteTitle: string;
  folderId: string;
}

export default function ActionsScreen({ notes, tree, onToggle }: Props) {
  const allFolders = flattenFolders(tree);

  const allActions: FlatAction[] = [];
  notes.forEach(n => {
    n.actionItems.forEach((a, i) => {
      allActions.push({
        noteId: n.id,
        idx: i,
        text: a.text,
        due: a.due,
        done: a.done,
        noteTitle: n.title,
        folderId: n.folderId,
      });
    });
  });

  const groups: Record<string, FlatAction[]> = {};
  allActions.forEach(a => {
    if (!groups[a.folderId]) groups[a.folderId] = [];
    groups[a.folderId].push(a);
  });

  const pending = allActions.filter(a => !a.done).length;

  return (
    <View style={styles.container}>
      <TopBar
        subtitle={pending > 0 ? `${pending} open` : 'All done'}
        title="Action items"
      />
      <ScrollView contentContainerStyle={styles.content}>
        {allActions.length === 0 ? (
          <Text style={styles.empty}>
            No action items yet. They appear here automatically after you record a note.
          </Text>
        ) : (
          Object.entries(groups).map(([folderId, items]) => (
            <View key={folderId} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupLabel}>
                  📁  {folderPathLabel(folderId, allFolders)}
                </Text>
              </View>
              {items.map((a, i) => (
                <View key={i} style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => onToggle(a.noteId, a.idx)}
                    style={styles.checkbox}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={[styles.checkboxBox, a.done && styles.checkboxDone]}>
                      {a.done && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionTextCol}
                    onPress={() => onToggle(a.noteId, a.idx)}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.actionText, a.done && styles.actionDone]}>
                      {a.text}
                    </Text>
                    <Text style={styles.actionMeta}>
                      {a.noteTitle}
                      {a.due ? `  ·  ⏰ ${a.due}` : ''}
                    </Text>
                  </TouchableOpacity>
                  <SpeakButton text={a.text} />
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 12, paddingBottom: 24 },
  empty: {
    fontSize: FONTS.size.md,
    color: COLORS.brownFaint,
    textAlign: 'center',
    marginTop: 48,
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  group: { marginBottom: 20 },
  groupHeader: {
    paddingHorizontal: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    marginBottom: 6,
  },
  groupLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    gap: 8,
  },
  checkbox: { paddingTop: 1 },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.brownLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: COLORS.brown,
    borderColor: COLORS.brown,
  },
  checkmark: { fontSize: 11, color: '#fff' },
  actionTextCol: { flex: 1 },
  actionText: { fontSize: FONTS.size.md, color: COLORS.brown },
  actionDone: { textDecorationLine: 'line-through', color: COLORS.brownFaint },
  actionMeta: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    marginTop: 3,
  },
});
