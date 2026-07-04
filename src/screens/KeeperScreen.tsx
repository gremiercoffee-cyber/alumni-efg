import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ActionSheetModal from '../components/ActionSheetModal';
import NamePromptModal from '../components/NamePromptModal';
import TopBar from '../components/TopBar';
import { COLORS, FONTS } from '../constants';
import { flattenFolders, folderPathLabel, formatDate } from '../utils';
import { FolderNode, KeeperItem } from '../types';

interface Props {
  keeperTree: FolderNode;
  items: KeeperItem[];
  processing: boolean;
  error: string | null;
  onDeleteItem: (itemId: string) => void;
  onAddText: (text: string) => void;
  onRecord: () => void;
  onRenameCategory: (categoryId: string, name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
}

export default function KeeperScreen({
  keeperTree,
  items,
  processing,
  error,
  onDeleteItem,
  onAddText,
  onRecord,
  onRenameCategory,
  onDeleteCategory,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [categoryActions, setCategoryActions] = useState<{ id: string; name: string } | null>(null);
  const [renameCategory, setRenameCategory] = useState<{ id: string; name: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [brokenFavicons, setBrokenFavicons] = useState<Record<string, boolean>>({});
  const categories = flattenFolders(keeperTree);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const itemCategoryLabels = useMemo(() => {
    return items.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = folderPathLabel(item.categoryId, categories);
      return acc;
    }, {});
  }, [items]);
  const filteredItems = useMemo(
    () => (activeCategoryId === 'all' ? items : items.filter(item => item.categoryId === activeCategoryId)),
    [activeCategoryId, items]
  );
  const columns = useMemo(() => {
    return filteredItems.reduce<[KeeperItem[], KeeperItem[]]>(
      (acc, item, index) => {
        acc[index % 2].push(item);
        return acc;
      },
      [[], []]
    );
  }, [filteredItems]);

  const submitText = () => {
    const text = draft.trim();
    if (!text) return;
    onAddText(text);
    setDraft('');
    setModalVisible(false);
  };

  const confirmDelete = (item: KeeperItem) => {
    Alert.alert('Remove from Keeper?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => onDeleteItem(item.id),
      },
    ]);
  };

  const getDomain = (url: string | null) => {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const getFaviconUri = (url: string | null) => {
    const domain = getDomain(url);
    return domain ? `https://www.google.com/s2/favicons?sz=64&domain=${domain}` : null;
  };

  return (
    <View style={styles.container}>
      <TopBar subtitle={`${items.length} kept`} title="Keeper" />
      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarOpen(open => !open)} activeOpacity={0.82}>
          <Text style={styles.menuBtnText}>≡</Text>
        </TouchableOpacity>
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>
            {activeCategoryId === 'all' ? 'All items' : folderPathLabel(activeCategoryId, categories)}
          </Text>
        </View>
      </View>
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

        {filteredItems.length === 0 ? (
          <Text style={styles.empty}>
            {items.length === 0
              ? 'Add a link, a quick thought, or a dictated keep note and it will stay here by category.'
              : 'No Keeper items match this category yet.'}
          </Text>
        ) : (
          <View style={styles.grid}>
            {columns.map((column, columnIndex) => (
              <View key={`column-${columnIndex}`} style={styles.column}>
                {column.map(item => {
                  const domain = getDomain(item.url);
                  const faviconUri = getFaviconUri(item.url);
                  const showFavicon = !!faviconUri && !brokenFavicons[item.id];

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.itemCard}
                      activeOpacity={item.url ? 0.75 : 1}
                      onPress={() => {
                        if (item.url) {
                          Linking.openURL(item.url);
                        }
                      }}
                      onLongPress={() => confirmDelete(item)}
                      delayLongPress={280}
                    >
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => confirmDelete(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.deleteBtnText}>×</Text>
                      </TouchableOpacity>

                      <View style={styles.cardTopRow}>
                        {showFavicon ? (
                          <Image
                            source={{ uri: faviconUri }}
                            style={styles.favicon}
                            onError={() =>
                              setBrokenFavicons(current => ({ ...current, [item.id]: true }))
                            }
                          />
                        ) : (
                          <View style={styles.domainBadge}>
                            <Text style={styles.domainBadgeText} numberOfLines={1}>
                              {domain || 'Note'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.categoryPill}>
                          <Text style={styles.categoryPillText} numberOfLines={1}>
                            {itemCategoryLabels[item.id]}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.itemTitle} numberOfLines={3}>{item.title}</Text>
                      <Text style={styles.itemSummary} numberOfLines={4}>
                        {item.summary || item.text}
                      </Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {domain || 'Kept note'} · {formatDate(item.ts)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {sidebarOpen ? (
        <View style={styles.sidebarOverlay}>
          <Pressable style={styles.sidebarDismiss} onPress={() => setSidebarOpen(false)} />
          <View style={styles.sidebar}>
            <Text style={styles.sidebarTitle}>Keeper categories</Text>
            {[{ id: 'all', name: 'All' }, ...categories.slice(1)].map(category => (
              <View key={category.id} style={[styles.sidebarItemRow, activeCategoryId === category.id && styles.sidebarItemActive]}>
                <TouchableOpacity
                  style={styles.sidebarItemButton}
                  onPress={() => {
                    setActiveCategoryId(category.id);
                    setSidebarOpen(false);
                  }}
                  onLongPress={() => {
                    if (category.id === 'all') return;
                    setCategoryActions({ id: category.id, name: category.name });
                  }}
                  activeOpacity={0.82}
                >
                  <Text
                    style={[
                      styles.sidebarItemText,
                      activeCategoryId === category.id && styles.sidebarItemTextActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
                {category.id !== 'all' ? (
                  <TouchableOpacity
                    style={styles.sidebarEditBtn}
                    onPress={() => {
                      setRenameCategory({ id: category.id, name: category.name });
                      setRenameDraft(category.name);
                    }}
                    activeOpacity={0.82}
                  >
                    <MaterialCommunityIcons
                      name="pencil"
                      size={15}
                      color={activeCategoryId === category.id ? COLORS.bg : COLORS.brownLight}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

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

      <ActionSheetModal
        visible={!!categoryActions}
        title={categoryActions?.name || 'Category'}
        message="Choose an action"
        options={[
          {
            label: 'Rename',
            onPress: () => {
              if (!categoryActions) return;
              setRenameCategory(categoryActions);
              setRenameDraft(categoryActions.name);
              setCategoryActions(null);
            },
          },
          {
            label: 'Delete',
            destructive: true,
            onPress: () => {
              if (!categoryActions) return;
              const itemCount = items.filter(item => item.categoryId === categoryActions.id).length;
              const target = categoryActions.id;
              setCategoryActions(null);
              Alert.alert(
                'Delete this category?',
                itemCount
                  ? `This will move ${itemCount} item${itemCount === 1 ? '' : 's'} to Uncategorized.`
                  : 'Delete this empty category?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onDeleteCategory(target) },
                ]
              );
            },
          },
        ]}
        onCancel={() => setCategoryActions(null)}
      />

      <NamePromptModal
        visible={!!renameCategory}
        title="Rename category"
        placeholder="Category name"
        value={renameDraft}
        onChangeText={setRenameDraft}
        onConfirm={() => {
          const trimmed = renameDraft.trim();
          if (!trimmed || !renameCategory) return;
          onRenameCategory(renameCategory.id, trimmed);
          setRenameCategory(null);
          setRenameDraft('');
        }}
        onCancel={() => {
          setRenameCategory(null);
          setRenameDraft('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  menuBtnText: {
    fontSize: 18,
    color: COLORS.brown,
    fontWeight: '700',
  },
  filterBadge: {
    backgroundColor: COLORS.cream,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterBadgeText: {
    color: COLORS.brown,
    fontSize: FONTS.size.xs,
    fontWeight: '600',
  },
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
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 4,
  },
  column: {
    flex: 1,
  },
  itemCard: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    minHeight: 148,
    position: 'relative',
  },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94, 70, 59, 0.08)',
    zIndex: 2,
  },
  deleteBtnText: {
    fontSize: 16,
    lineHeight: 18,
    color: COLORS.brownLight,
    fontWeight: '600',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 28,
    marginBottom: 10,
  },
  favicon: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  domainBadge: {
    maxWidth: 92,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.cream,
  },
  domainBadgeText: {
    fontSize: 11,
    color: COLORS.brown,
  },
  categoryPill: {
    flex: 1,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(123, 93, 72, 0.1)',
  },
  categoryPillText: {
    fontSize: 11,
    color: COLORS.brownLight,
  },
  itemTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.brown,
    paddingRight: 18,
  },
  itemSummary: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    marginTop: 6,
    lineHeight: 17,
  },
  itemMeta: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    marginTop: 10,
  },
  sidebarOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  sidebarDismiss: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  sidebar: {
    width: 240,
    backgroundColor: COLORS.bgAlt,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 54,
  },
  sidebarTitle: {
    color: COLORS.brown,
    fontSize: FONTS.size.sm,
    fontWeight: '700',
    marginBottom: 12,
  },
  sidebarItem: {
    backgroundColor: COLORS.brown,
  },
  sidebarItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 6,
  },
  sidebarItemButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  sidebarItemActive: {
    backgroundColor: COLORS.brown,
  },
  sidebarItemText: {
    color: COLORS.brownMid,
    fontSize: FONTS.size.sm,
  },
  sidebarItemTextActive: {
    color: COLORS.bg,
    fontWeight: '700',
  },
  sidebarEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
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
