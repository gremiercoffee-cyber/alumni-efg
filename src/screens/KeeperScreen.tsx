import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import TopBar from '../components/TopBar';
import { COLORS, FONTS } from '../constants';
import { flattenFolders, folderPathLabel, formatDate } from '../utils';
import { FolderNode, KeeperItem } from '../types';

interface Props {
  keeperTree: FolderNode;
  items: KeeperItem[];
  processing: boolean;
  error: string | null;
  onAddText: (text: string) => void;
  onRecord: () => void;
}

export default function KeeperScreen({
  keeperTree,
  items,
  processing,
  error,
  onAddText,
  onRecord,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState('');
  const categories = flattenFolders(keeperTree);
  const grouped = useMemo(() => {
    return items.reduce<Record<string, KeeperItem[]>>((acc, item) => {
      if (!acc[item.categoryId]) acc[item.categoryId] = [];
      acc[item.categoryId].push(item);
      return acc;
    }, {});
  }, [items]);

  const submitText = () => {
    const text = draft.trim();
    if (!text) return;
    onAddText(text);
    setDraft('');
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <TopBar subtitle={`${items.length} kept`} title="Keeper" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroCount}>{items.length}</Text>
          <Text style={styles.heroLabel}>{items.length === 1 ? 'Kept item' : 'Kept items'}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={onRecord} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>Record</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>Type</Text>
            </TouchableOpacity>
          </View>
          {processing && <Text style={styles.processing}>Saving to Keeper...</Text>}
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {items.length === 0 ? (
          <Text style={styles.empty}>
            Add a link, a quick thought, or a dictated keep note and it will stay here by category.
          </Text>
        ) : (
          Object.entries(grouped).map(([categoryId, categoryItems]) => (
            <View key={categoryId} style={styles.group}>
              <Text style={styles.groupLabel}>
                {folderPathLabel(categoryId, categories)}
              </Text>
              {categoryItems.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemCard}
                  activeOpacity={item.url ? 0.75 : 1}
                  onPress={() => {
                    if (item.url) {
                      Linking.openURL(item.url);
                    }
                  }}
                >
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.itemSummary} numberOfLines={3}>{item.summary}</Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {formatDate(item.ts)}
                    {item.url ? ` - ${item.url}` : ' - kept note'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Keep something</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Type anything you want to keep..."
              placeholderTextColor={COLORS.brownFaint}
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setDraft('');
                  setModalVisible(false);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCreate} onPress={submitText}>
                <Text style={styles.modalCreateText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 28 },
  hero: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 20,
  },
  heroCount: {
    fontSize: 54,
    fontWeight: '700',
    color: COLORS.brown,
    lineHeight: 58,
  },
  heroLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryBtn: {
    minWidth: 128,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brown,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryBtnText: {
    fontSize: FONTS.size.md,
    color: COLORS.bg,
    fontWeight: '600',
  },
  secondaryBtn: {
    minWidth: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondaryBtnText: {
    fontSize: FONTS.size.md,
    color: COLORS.brown,
    fontWeight: '600',
  },
  processing: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    marginTop: 8,
  },
  empty: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownFaint,
    textAlign: 'center',
    marginTop: 28,
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: '#f3e3da',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: FONTS.size.sm,
    color: '#7a3a22',
    textAlign: 'center',
  },
  group: { marginBottom: 20 },
  groupLabel: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  itemCard: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.brown,
  },
  itemSummary: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    marginTop: 4,
    lineHeight: 17,
  },
  itemMeta: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    width: '84%',
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: '600',
    color: COLORS.brown,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: FONTS.size.md,
    color: COLORS.brown,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: { paddingVertical: 8, paddingHorizontal: 12 },
  modalCancelText: { fontSize: FONTS.size.md, color: COLORS.brownFaint },
  modalCreate: {
    backgroundColor: COLORS.brown,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  modalCreateText: { fontSize: FONTS.size.md, color: COLORS.bg, fontWeight: '600' },
});
