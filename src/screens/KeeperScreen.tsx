import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import TopBar from '../components/TopBar';
import { COLORS, FONTS } from '../constants';
import { flattenFolders, folderPathLabel, formatDate } from '../utils';
import { FolderNode, SavedLink } from '../types';

interface Props {
  keeperTree: FolderNode;
  links: SavedLink[];
  processing: boolean;
  error: string | null;
}

export default function KeeperScreen({ keeperTree, links, processing, error }: Props) {
  const categories = flattenFolders(keeperTree);
  const grouped = links.reduce<Record<string, SavedLink[]>>((acc, link) => {
    if (!acc[link.categoryId]) acc[link.categoryId] = [];
    acc[link.categoryId].push(link);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <TopBar subtitle={`${links.length} saved`} title="Keeper" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroCount}>{links.length}</Text>
          <Text style={styles.heroLabel}>{links.length === 1 ? 'Saved link' : 'Saved links'}</Text>
          {processing && <Text style={styles.processing}>Saving shared link...</Text>}
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {links.length === 0 ? (
          <Text style={styles.empty}>
            Shared links will appear here after you send them to NoteKeeper from another app.
          </Text>
        ) : (
          Object.entries(grouped).map(([categoryId, items]) => (
            <View key={categoryId} style={styles.group}>
              <Text style={styles.groupLabel}>
                {folderPathLabel(categoryId, categories)}
              </Text>
              {items.map(link => (
                <TouchableOpacity
                  key={link.id}
                  style={styles.linkCard}
                  activeOpacity={0.75}
                  onPress={() => Linking.openURL(link.url)}
                >
                  <Text style={styles.linkTitle} numberOfLines={2}>{link.title}</Text>
                  <Text style={styles.linkSummary} numberOfLines={2}>{link.summary}</Text>
                  <Text style={styles.linkMeta} numberOfLines={1}>
                    {formatDate(link.ts)} - {link.url}
                  </Text>
                </TouchableOpacity>
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
  linkCard: {
    backgroundColor: COLORS.white50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  linkTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.brown,
  },
  linkSummary: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownLight,
    marginTop: 4,
    lineHeight: 17,
  },
  linkMeta: {
    fontSize: FONTS.size.xs,
    color: COLORS.brownFaint,
    marginTop: 6,
  },
});
