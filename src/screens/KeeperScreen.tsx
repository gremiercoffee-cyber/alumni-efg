import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ActionSheetModal from '../components/ActionSheetModal';
import ColorPickerModal from '../components/ColorPickerModal';
import NamePromptModal from '../components/NamePromptModal';
import TopBar from '../components/TopBar';
import { COLORS, FONTS } from '../constants';
import { findNode, flattenFolders, folderPathLabel, formatDate } from '../utils';
import { FolderNode, KeeperItem } from '../types';

interface Props {
  keeperTree: FolderNode;
  items: KeeperItem[];
  processing: boolean;
  error: string | null;
  onDeleteItem: (itemId: string) => void;
  onUpdateItem: (id: string, updates: Partial<KeeperItem>) => void;
  onAddText: (text: string) => void;
  onRecord: () => void;
  onRenameCategory: (categoryId: string, name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onChangeCategoryColor: (categoryId: string, color: string) => void;
  onAddCategory: (name: string) => string;
}

export default function KeeperScreen({
  keeperTree,
  items,
  processing,
  error,
  onDeleteItem,
  onUpdateItem,
  onAddText,
  onRecord,
  onRenameCategory,
  onDeleteCategory,
  onChangeCategoryColor,
  onAddCategory,
}: Props) {
  const { height: screenHeight } = useWindowDimensions();

  const [modalVisible, setModalVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [categoryActions, setCategoryActions] = useState<{ id: string; name: string } | null>(null);
  const [colorCategory, setColorCategory] = useState<{ id: string; name: string; color: string | null } | null>(null);
  const [renameCategory, setRenameCategory] = useState<{ id: string; name: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [brokenFavicons, setBrokenFavicons] = useState<Record<string, boolean>>({});

  // Detail sheet state
  const [detailItem, setDetailItem] = useState<KeeperItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editKind, setEditKind] = useState<'link' | 'text'>('text');
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [newCategoryVisible, setNewCategoryVisible] = useState(false);
  const [newCategoryDraft, setNewCategoryDraft] = useState('');

  // Quick action (long-press) state
  const [quickActionItem, setQuickActionItem] = useState<KeeperItem | null>(null);

  // Android back button: close open panels in priority order
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editMode) { setEditMode(false); return true; }
      if (detailItem) { closeDetail(); return true; }
      if (categoryPickerVisible) { setCategoryPickerVisible(false); return true; }
      if (sidebarOpen) { setSidebarOpen(false); return true; }
      if (modalVisible) { setModalVisible(false); return true; }
      return false;
    });
    return () => handler.remove();
  }, [editMode, detailItem, categoryPickerVisible, sidebarOpen, modalVisible]);

  const categories = flattenFolders(keeperTree);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');

  const itemCategoryLabels = useMemo(() => {
    return items.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = folderPathLabel(item.categoryId, categories);
      return acc;
    }, {});
  }, [items, categories]);

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

  const confirmDeleteItem = (item: KeeperItem) => {
    Alert.alert('Delete this item from Keeper?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (detailItem?.id === item.id) closeDetail();
          onDeleteItem(item.id);
        },
      },
    ]);
  };

  const closeDetail = () => {
    setDetailItem(null);
    setEditMode(false);
  };

  const shareItem = (item: KeeperItem) => {
    const message = item.url
      ? `${item.title}\n${item.url}${item.text ? '\n\n' + item.text : ''}`
      : `${item.title}\n\n${item.text}`;
    Share.share({ title: item.title, message });
  };

  const enterEditMode = (item: KeeperItem) => {
    setEditTitle(item.title);
    setEditContent(item.text);
    setEditCategoryId(item.categoryId);
    setEditKind(item.kind);
    setEditMode(true);
  };

  const saveEdits = () => {
    if (!detailItem) return;
    const updates: Partial<KeeperItem> = {
      title: editTitle.trim() || detailItem.title,
      text: editContent,
      categoryId: editCategoryId,
      kind: editKind,
    };
    onUpdateItem(detailItem.id, updates);
    setDetailItem({ ...detailItem, ...updates });
    setEditMode(false);
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

  const getCategoryColor = (categoryId: string): string | null => {
    if (categoryId === 'all') return null;
    return findNode(keeperTree, categoryId)?.color || null;
  };

  const categoryLabel = (id: string) => folderPathLabel(id, categories);

  // Render category chips for the edit mode picker
  const renderCategoryPicker = () => {
    const nonRootCategories = categories.filter(c => c.id !== 'keeper-root');
    return (
      <Modal visible={categoryPickerVisible} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={styles.pickerOverlay} onPress={() => setCategoryPickerVisible(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Choose category</Text>
            <ScrollView style={styles.pickerScroll} contentContainerStyle={styles.pickerChips}>
              {nonRootCategories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.pickerChip, editCategoryId === cat.id && styles.pickerChipActive]}
                  onPress={() => {
                    setEditCategoryId(cat.id);
                    setCategoryPickerVisible(false);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.pickerChipText, editCategoryId === cat.id && styles.pickerChipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.pickerChipNew}
                onPress={() => {
                  setCategoryPickerVisible(false);
                  setNewCategoryDraft('');
                  setNewCategoryVisible(true);
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.pickerChipNewText}>+ New category</Text>
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => setCategoryPickerVisible(false)}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
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
                  // Show first 3-4 lines of actual content, not summary
                  const previewText = item.text || item.summary;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.itemCard}
                      activeOpacity={0.75}
                      onPress={() => { setDetailItem(item); enterEditMode(item); }}
                      onLongPress={() => setQuickActionItem(item)}
                      delayLongPress={280}
                    >
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => confirmDeleteItem(item)}
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
                        {previewText}
                      </Text>
                      <View style={styles.cardBottomRow}>
                        <Text style={styles.itemMeta} numberOfLines={1}>
                          {domain || 'Kept note'} · {formatDate(item.ts)}
                        </Text>
                        <TouchableOpacity
                          style={styles.cardShareBtn}
                          onPress={() => shareItem(item)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.cardShareBtnText}>↑</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sidebar */}
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
                  {getCategoryColor(category.id) ? (
                    <View style={[styles.sidebarColorDot, { backgroundColor: getCategoryColor(category.id)! }]} />
                  ) : null}
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
                      setCategoryActions({ id: category.id, name: category.name });
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

      {/* Add text modal */}
      <Modal visible={modalVisible} transparent animationType="slide" statusBarTranslucent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ height: '88%', backgroundColor: COLORS.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <Text style={{ fontSize: 11, letterSpacing: 2, color: COLORS.brownLight, textAlign: 'center' }}>KEEPER</Text>
              <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.brown, textAlign: 'center', marginTop: 4 }}>Keep something</Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <TextInput
                style={styles.modalInput}
                placeholder="Type anything you want to keep..."
                placeholderTextColor={COLORS.brownFaint}
                value={draft}
                onChangeText={setDraft}
                multiline
                autoFocus
              />
            </ScrollView>
            <View style={{ flexDirection: 'row', padding: 16, paddingBottom: 32, gap: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg }}>
              <TouchableOpacity
                onPress={() => { setDraft(''); setModalVisible(false); }}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 30, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' }}
              >
                <Text style={{ color: COLORS.brownLight }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitText}
                style={{ flex: 2, paddingVertical: 16, borderRadius: 30, backgroundColor: COLORS.brown, alignItems: 'center' }}
              >
                <Text style={{ color: COLORS.bg, fontWeight: '600' }}>Save to Keeper</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detail sheet */}
      <Modal
        visible={!!detailItem}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={closeDetail}
      >
        <Pressable style={styles.detailBackdrop} onPress={editMode ? () => setEditMode(false) : closeDetail}>
          <Pressable style={[styles.detailSheet, { height: screenHeight * 0.88 }]} onPress={e => e.stopPropagation()}>
            {/* Fixed header */}
            <View style={styles.detailHeader}>
              <View style={styles.detailHeaderTopRow}>
                {/* Category pill */}
                {editMode ? (
                  <TouchableOpacity
                    style={styles.detailCategoryPill}
                    onPress={() => setCategoryPickerVisible(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.detailCategoryPillText} numberOfLines={1}>
                      {categoryLabel(editCategoryId)} ▾
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.detailCategoryPill}>
                    <Text style={styles.detailCategoryPillText} numberOfLines={1}>
                      {detailItem ? categoryLabel(detailItem.categoryId) : ''}
                    </Text>
                  </View>
                )}
                {/* Type badge */}
                {editMode ? (
                  <TouchableOpacity
                    style={styles.detailTypeBadge}
                    onPress={() => setEditKind(k => k === 'link' ? 'text' : 'link')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.detailTypeBadgeText}>
                      {editKind === 'link' ? 'Link' : 'Note'} ▾
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.detailTypeBadge}>
                    <Text style={styles.detailTypeBadgeText}>
                      {detailItem?.kind === 'link' ? 'Link' : 'Note'}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                {/* Close button */}
                <TouchableOpacity
                  style={styles.detailCloseBtn}
                  onPress={editMode ? () => setEditMode(false) : closeDetail}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.detailCloseBtnText}>×</Text>
                </TouchableOpacity>
              </View>
              {/* Title */}
              {editMode ? (
                <TextInput
                  style={styles.detailTitleInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Title"
                  placeholderTextColor={COLORS.brownFaint}
                  multiline
                />
              ) : (
                <Text style={styles.detailTitle}>{detailItem?.title}</Text>
              )}
            </View>

            {/* Scrollable body */}
            <ScrollView
              style={styles.detailBody}
              contentContainerStyle={styles.detailBodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {editMode ? (
                <TextInput
                  style={styles.detailContentInput}
                  value={editContent}
                  onChangeText={setEditContent}
                  placeholder="Content..."
                  placeholderTextColor={COLORS.brownFaint}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                />
              ) : detailItem?.kind === 'link' ? (
                <View>
                  {detailItem.url ? (
                    <TouchableOpacity
                      onPress={() => detailItem.url && Linking.openURL(detailItem.url)}
                      activeOpacity={0.75}
                      style={styles.detailLinkRow}
                    >
                      <Text style={styles.detailLinkText} numberOfLines={2}>{detailItem.url}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {detailItem.text ? (
                    <Text style={styles.detailContentText}>{detailItem.text}</Text>
                  ) : null}
                  {detailItem.url ? (
                    <TouchableOpacity
                      style={styles.openLinkBtn}
                      onPress={() => detailItem.url && Linking.openURL(detailItem.url)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.openLinkBtnText}>Open link</Text>
                    </TouchableOpacity>
                  ) : null}
                  <Text style={styles.detailMeta}>Kept {formatDate(detailItem.ts)}</Text>
                  <Text style={styles.detailMeta}>{categoryLabel(detailItem.categoryId)}</Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.detailContentText}>{detailItem?.text || detailItem?.summary}</Text>
                  <Text style={[styles.detailMeta, { marginTop: 20 }]}>
                    Kept {detailItem ? formatDate(detailItem.ts) : ''}
                  </Text>
                  <Text style={styles.detailMeta}>
                    {detailItem ? categoryLabel(detailItem.categoryId) : ''}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Fixed footer */}
            <View style={styles.detailFooter}>
              {editMode ? (
                <>
                  <TouchableOpacity
                    style={styles.footerBtnSecondary}
                    onPress={() => setEditMode(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.footerBtnSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.footerBtnSecondary}
                    onPress={() => detailItem && shareItem({ ...detailItem, title: editTitle, text: editContent })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.footerBtnSecondaryText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.footerBtnPrimary}
                    onPress={saveEdits}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.footerBtnPrimaryText}>Save</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.footerBtnSecondary}
                    onPress={() => detailItem && enterEditMode(detailItem)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.footerBtnSecondaryText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.footerBtnSecondary}
                    onPress={() => detailItem && shareItem(detailItem)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.footerBtnSecondaryText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.footerBtnDestructive}
                    onPress={() => detailItem && confirmDeleteItem(detailItem)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.footerBtnDestructiveText}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.footerBtnPrimary}
                    onPress={closeDetail}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.footerBtnPrimaryText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Category picker for edit mode */}
      {renderCategoryPicker()}

      {/* New category prompt */}
      <NamePromptModal
        visible={newCategoryVisible}
        title="New category"
        placeholder="Category name"
        value={newCategoryDraft}
        onChangeText={setNewCategoryDraft}
        onConfirm={() => {
          const trimmed = newCategoryDraft.trim();
          if (!trimmed) return;
          const newId = onAddCategory(trimmed);
          setEditCategoryId(newId);
          setNewCategoryVisible(false);
          setNewCategoryDraft('');
        }}
        onCancel={() => {
          setNewCategoryVisible(false);
          setNewCategoryDraft('');
        }}
      />

      {/* Long-press quick action sheet */}
      <ActionSheetModal
        visible={!!quickActionItem}
        title={quickActionItem?.title || 'Item'}
        message="Choose an action"
        options={[
          {
            label: 'Edit',
            onPress: () => {
              const item = quickActionItem!;
              setQuickActionItem(null);
              setDetailItem(item);
              enterEditMode(item);
            },
          },
          {
            label: 'Delete',
            destructive: true,
            onPress: () => {
              const item = quickActionItem!;
              setQuickActionItem(null);
              confirmDeleteItem(item);
            },
          },
        ]}
        onCancel={() => setQuickActionItem(null)}
      />

      {/* Category management action sheet */}
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
            label: 'Change color',
            onPress: () => {
              if (!categoryActions) return;
              setColorCategory({
                id: categoryActions.id,
                name: categoryActions.name,
                color: getCategoryColor(categoryActions.id),
              });
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

      <ColorPickerModal
        visible={!!colorCategory}
        selectedColor={colorCategory?.color || null}
        onSelectColor={color => {
          if (!colorCategory) return;
          onChangeCategoryColor(colorCategory.id, color);
          setColorCategory(null);
        }}
        onCancel={() => setColorCategory(null)}
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
  content: { paddingHorizontal: 16, paddingBottom: 28 },
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
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  itemMeta: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    flex: 1,
  },
  cardShareBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginLeft: 6,
  },
  cardShareBtnText: {
    fontSize: 12,
    lineHeight: 14,
    color: COLORS.brownLight,
    fontWeight: '600',
  },

  // Sidebar
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
  sidebarItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 6,
  },
  sidebarItemButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  sidebarColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(58, 46, 31, 0.18)',
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
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: FONTS.size.md,
    color: COLORS.brown,
    minHeight: 120,
    textAlignVertical: 'top',
  },

  // Detail sheet
  detailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  detailHeader: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailCategoryPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(123, 93, 72, 0.12)',
    maxWidth: 160,
  },
  detailCategoryPillText: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    fontWeight: '600',
  },
  detailTypeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: COLORS.cream,
  },
  detailTypeBadgeText: {
    fontSize: FONTS.size.xs,
    color: COLORS.brown,
    fontWeight: '600',
  },
  detailCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94, 70, 59, 0.1)',
  },
  detailCloseBtnText: {
    fontSize: 18,
    lineHeight: 20,
    color: COLORS.brownLight,
    fontWeight: '600',
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.brown,
    lineHeight: 28,
  },
  detailTitleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.brown,
    lineHeight: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 8,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  detailBody: {
    flex: 1,
  },
  detailBodyContent: {
    padding: 20,
    paddingBottom: 24,
  },
  detailContentText: {
    fontSize: FONTS.size.base,
    color: COLORS.brown,
    lineHeight: 24,
  },
  detailContentInput: {
    fontSize: FONTS.size.base,
    color: COLORS.brown,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 180,
    textAlignVertical: 'top',
  },
  detailLinkRow: {
    backgroundColor: COLORS.cream,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  detailLinkText: {
    fontSize: FONTS.size.sm,
    color: '#4a72b8',
    textDecorationLine: 'underline',
  },
  openLinkBtn: {
    backgroundColor: COLORS.brown,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  openLinkBtnText: {
    color: COLORS.bg,
    fontWeight: '600',
    fontSize: FONTS.size.base,
  },
  detailMeta: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    marginTop: 6,
  },
  detailFooter: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  footerBtnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  footerBtnSecondaryText: {
    color: COLORS.brownLight,
    fontWeight: '600',
    fontSize: FONTS.size.sm,
  },
  footerBtnDestructive: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.red,
    alignItems: 'center',
  },
  footerBtnDestructiveText: {
    color: COLORS.red,
    fontWeight: '600',
    fontSize: FONTS.size.sm,
  },
  footerBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: COLORS.brown,
    alignItems: 'center',
  },
  footerBtnPrimaryText: {
    color: COLORS.bg,
    fontWeight: '600',
    fontSize: FONTS.size.sm,
  },

  // Category picker
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: 400,
  },
  pickerTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: '700',
    color: COLORS.brown,
    marginBottom: 14,
    textAlign: 'center',
  },
  pickerScroll: {
    maxHeight: 220,
  },
  pickerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  pickerChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  pickerChipActive: {
    backgroundColor: COLORS.brown,
    borderColor: COLORS.brown,
  },
  pickerChipText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brown,
  },
  pickerChipTextActive: {
    color: COLORS.bg,
    fontWeight: '600',
  },
  pickerChipNew: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  pickerChipNewText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownLight,
  },
  pickerCancel: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  pickerCancelText: {
    fontSize: FONTS.size.sm,
    color: COLORS.brownLight,
  },
});
