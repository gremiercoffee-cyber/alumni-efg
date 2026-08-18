import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { pushStatus, type PushState } from '../lib/push';
import { colors, radius, space, type } from '../theme';
import { topInset } from '../components/ui';

/**
 * Admin tools, behind a hamburger on the left.
 *
 * Kept out of the tab bar deliberately: tabs are the four things done many
 * times a day, and burying them under a fifth and sixth would cost that. These
 * are the occasional jobs -- setting someone up, managing an event -- and they
 * belong somewhere you go on purpose.
 *
 * Slid in by hand rather than with a drawer library: those need
 * react-native-screens and react-native-reanimated, both native modules, and
 * every one of those makes a rebuild necessary for changes that should ship
 * over the air.
 */

export type AdminTool = {
  id: string;
  label: string;
  hint: string;
  icon: string;
  ready: boolean;
};

export const ADMIN_TOOLS: AdminTool[] = [
  {
    id: 'reported',
    label: 'Reported by others',
    hint: 'Simchas someone else has told you about',
    icon: 'inbox-arrow-down-outline',
    ready: true,
  },
  {
    id: 'edits',
    label: 'Proposed changes',
    hint: 'Corrections other people have suggested',
    icon: 'pencil-outline',
    ready: true,
  },
  {
    id: 'stays',
    label: 'Staying in yeshiva',
    hint: 'Who is here, for how long, and who still needs a bed',
    icon: 'bed-outline',
    ready: true,
  },
  {
    id: 'events',
    label: 'Events & RSVPs',
    hint: 'Add an event, share its link, see who is coming',
    icon: 'calendar-star',
    ready: true,
  },
  {
    id: 'pending',
    label: 'People waiting',
    hint: 'Let someone in, and decide what they can do',
    icon: 'account-clock-outline',
    ready: true,
  },
];

export default function AdminDrawer({
  visible,
  onClose,
  onPick,
  onSignOut,
  email,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (tool: string) => void;
  onSignOut: () => void;
  email: string | null;
}) {
  const [push, setPush] = useState<{ state: PushState; detail?: string } | null>(null);

  // Checked when the drawer opens, not on every render.
  useEffect(() => {
    if (!visible) return;
    void pushStatus().then(setPush);
  }, [visible]);
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * 0.82, 320);
  const slide = useRef(new Animated.Value(-panelWidth)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : -panelWidth,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      // Layout animations cannot use the native driver on web, and this is a
      // translate, which can.
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, panelWidth, slide]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[styles.panel, { width: panelWidth, transform: [{ translateX: slide }] }]}
        >
          <View style={styles.head}>
            <Text style={styles.title}>Admin</Text>
            <Text style={styles.who} numberOfLines={1}>
              {email}
            </Text>
          </View>

          <ScrollView style={styles.list}>
            {ADMIN_TOOLS.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.item, !t.ready && styles.itemOff]}
                disabled={!t.ready}
                onPress={() => onPick(t.id)}
              >
                <MaterialCommunityIcons
                  name={t.icon as never}
                  size={20}
                  color={t.ready ? colors.cyan : colors.muted}
                />
                <View style={styles.itemText}>
                  <Text style={styles.itemLabel}>{t.label}</Text>
                  <Text style={styles.itemHint}>{t.ready ? t.hint : 'Not built yet'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Whether this phone will actually be told anything. Silence was the
              right default at launch and the wrong answer to someone checking. */}
          <TouchableOpacity
            style={styles.pushRow}
            onPress={async () => {
              setPush(null);
              const r = await pushStatus();
              setPush(r);
            }}
          >
            <MaterialCommunityIcons
              name={push?.state === 'registered' ? 'bell-check-outline' : 'bell-off-outline'}
              size={16}
              color={push?.state === 'registered' ? colors.cyan : colors.muted}
            />
            <Text style={styles.pushText}>
              {push === null
                ? 'Checking notifications…'
                : push.state === 'registered'
                ? 'Notifications on for this phone'
                : push.detail ?? 'Notifications are off'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOut} onPress={onSignOut}>
            <MaterialCommunityIcons name="logout" size={18} color={colors.muted} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.rest} activeOpacity={1} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pushRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: space.md,
  },
  pushText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, flex: 1 },
  backdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(3,9,26,0.55)' },
  rest: { flex: 1 },
  panel: {
    backgroundColor: colors.navy800,
    borderRightWidth: 1,
    borderRightColor: colors.ruleOnNavy,
    paddingTop: topInset + space.sm,
    paddingBottom: space.lg,
  },
  head: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleOnNavy,
  },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: colors.white },
  who: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.8 },
  list: { flex: 1, paddingTop: space.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 4,
    paddingHorizontal: space.md,
    paddingVertical: 13,
  },
  itemOff: { opacity: 0.45 },
  itemText: { flex: 1, gap: 1 },
  itemLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: colors.white },
  itemHint: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted, opacity: 0.8 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: space.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
  },
  signOutText: { ...type.body, fontSize: 14, color: colors.muted },
});
