import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import type { Profile } from './src/lib/supabase';
import {
  emptyFilters,
  loadDirectory,
  type AlumniRecord,
  type Directory,
  type Filters,
} from './src/lib/alumni';
import { loadFeed, type FeedItem } from './src/lib/simchas';
import SignInScreen from './src/screens/SignInScreen';
import HomeScreen from './src/screens/HomeScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import PersonScreen from './src/screens/PersonScreen';
import ReportScreen from './src/screens/ReportScreen';
import AdminScreen from './src/screens/AdminScreen';
import { topInset } from './src/components/ui';
import { colors, space, type } from './src/theme';

type Tab = 'home' | 'report' | 'contacts' | 'mine' | 'admin';

const TABS: [Tab, string, string][] = [
  ['home', '\u{1F3E0}', 'Home'],
  ['report', '\u{2795}', 'Report'],
  ['contacts', '\u{1F4C7}', 'Contacts'],
  ['mine', '\u{2B50}', 'My alumni'],
];

// Only an admin sees this one. For everyone else it is not a tab at all,
// rather than a tab that shows an error when tapped.
const ADMIN_TAB: [Tab, string, string] = ['admin', '\u{1F6E0}\uFE0F', 'To do'];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  const [tab, setTab] = useState<Tab>('home');
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [selected, setSelected] = useState<AlumniRecord | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [feedMine, setFeedMine] = useState(false);
  const [feedYear, setFeedYear] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Required by file, not from the package index: that index pulls in all 18
  // Poppins weights and Metro bundles every one into the web build.
  const [fontsLoaded] = useFonts({
    Poppins_400Regular: require('@expo-google-fonts/poppins/Poppins_400Regular.ttf'),
    Poppins_500Medium: require('@expo-google-fonts/poppins/Poppins_500Medium.ttf'),
    Poppins_600SemiBold: require('@expo-google-fonts/poppins/Poppins_600SemiBold.ttf'),
    Poppins_700Bold: require('@expo-google-fonts/poppins/Poppins_700Bold.ttf'),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      setLoadError(null);
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      setProfile(prof ?? null);
      const [dir, f] = await Promise.all([loadDirectory(prof?.staff_id ?? null), loadFeed()]);
      setDirectory(dir);
      setFeed(f);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load.');
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!ready || !fontsLoaded) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        <SignInScreen />
      </>
    );
  }

  const isAdmin = profile?.role === 'admin';

  const body = () => {
    if (selected) {
      return (
        <PersonScreen
          person={selected}
          onBack={() => setSelected(null)}
          onContacted={refresh}
        />
      );
    }
    switch (tab) {
      case 'home':
        return (
          <HomeScreen
            feed={feed}
            directory={directory}
            mineOnly={feedMine}
            year={feedYear}
            onMineOnly={setFeedMine}
            onYear={setFeedYear}
          />
        );
      case 'report':
        return <ReportScreen directory={directory} isAdmin={!!isAdmin} onDone={refresh} />;
      case 'admin':
        return <AdminScreen onChanged={refresh} />;
      default:
        return (
          <ContactsScreen
            directory={directory}
            filters={filters}
            onFilters={setFilters}
            onOpen={setSelected}
            onContacted={refresh}
            mineOnly={tab === 'mine'}
          />
        );
    }
  };

  return (
    <View style={styles.app}>
      <StatusBar style="light" />

      <View style={styles.appbar}>
        <View style={styles.brand}>
          <Text style={styles.brandName}>
            efg<Text style={styles.brandAt}>@</Text>aish
          </Text>
          {!directory && !loadError ? (
            <ActivityIndicator size="small" color={colors.cyan} style={{ marginLeft: 8 }} />
          ) : null}
        </View>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signout}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {loadError ? (
        <ScrollView contentContainerStyle={styles.errorWrap}>
          <Text style={styles.errorTitle}>Could not load</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <TouchableOpacity style={styles.retry} onPress={refresh}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={styles.flex}>{body()}</View>
      )}

      <View style={styles.tabs}>
        {(isAdmin ? [...TABS, ADMIN_TAB] : TABS).map(([key, icon, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabOn]}
            onPress={() => {
              setTab(key);
              setSelected(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={styles.tabIcon}>{icon}</Text>
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.navy900, paddingTop: topInset },
  flex: { flex: 1 },
  center: {
    flex: 1,
    backgroundColor: colors.navy900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm + 4,
  },
  brand: { flexDirection: 'row', alignItems: 'center' },
  brandName: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: colors.white },
  brandAt: { color: colors.cyan },
  signout: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.8 },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.ruleOnNavy,
    backgroundColor: colors.navy900,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 14 },
  tabOn: { borderTopWidth: 2, borderTopColor: colors.cyan, marginTop: -1 },
  tabIcon: { fontSize: 16, marginBottom: 3 },
  tabLabel: { ...type.label, fontSize: 9.5, color: colors.muted, opacity: 0.8 },
  tabLabelOn: { color: colors.cyan, opacity: 1 },
  errorWrap: { padding: space.lg, gap: space.sm },
  errorTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: colors.white },
  errorBody: { ...type.body, color: colors.muted },
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cyan,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: { fontFamily: 'Poppins_600SemiBold', color: colors.navy900 },
});
