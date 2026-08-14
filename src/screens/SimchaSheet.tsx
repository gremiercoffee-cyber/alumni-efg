import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateField from '../components/DatePicker';
import { labelFor, type FeedItem } from '../lib/simchas';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * Fix or remove something that has been filed.
 *
 * Anything a person types can be typed wrong, and a wrong date is not a small
 * thing here -- a wedding entered as 6 August instead of 6 September says a man
 * is married when he is not, and asks you to announce it. There was no way to
 * correct that, which meant the only remedy was leaving it wrong.
 *
 * Deliberately reachable from wherever the mistake is visible -- the feed and
 * the queue both -- rather than from a settings screen. You fix it where you
 * notice it.
 */

export default function SimchaSheet({
  item,
  personName,
  isAdmin,
  onClose,
  onChanged,
  onOpenPerson,
}: {
  item: FeedItem | null;
  personName?: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenPerson?: (personId: number) => void;
}) {
  const [date, setDate] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDate(item?.on_date ?? null);
    setNote(item?.note ?? '');
    setUntil(null);
  }, [item]);

  if (!item) return null;

  const isVisitRow = item.kind === 'visit';
  const isEventRow = item.kind === 'event';
  const table = isVisitRow ? 'visits' : isEventRow ? 'events' : 'simchas';
  const dateColumn = isVisitRow ? 'visited_on' : isEventRow ? 'starts_on' : 'occurred_on';
  const changed = date !== item.on_date || note !== (item.note ?? '');

  async function save() {
    if (!date) return;
    setBusy(true);
    try {
      const patch: Record<string, unknown> = { [dateColumn]: date, note: note.trim() || null };

      if (!isVisitRow && !isEventRow) {
        // A wedding carries its date twice. Leaving wedding_on behind would let
        // the old date go on driving reminders after the visible one was fixed.
        if (item.subtype === 'wedding' || item.subtype === 'child_wedding') {
          patch.wedding_on = date;
        }
        // Moving it back into the future means it has not happened yet, so any
        // record of having announced it is wrong.
        if (new Date(`${date}T00:00:00`) > new Date()) {
          patch.announced_at = null;
          patch.announced_by = null;
        }
      }

      if (isVisitRow) {
        patch.expected = new Date(`${date}T00:00:00`) > new Date();
        if (until) patch.until_date = until;
      }

      // The table is chosen at runtime, so the generated row types cannot line
      // up. The columns written are checked by hand above instead.
      const { error } = await (supabase.from(table) as never as {
        update: (p: Record<string, unknown>) => {
          eq: (c: string, v: number) => Promise<{ error: { message: string } | null }>;
        };
      })
        .update(patch)
        .eq('id', item.id);
      if (error) throw error;
      onChanged();
      onClose();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    Alert.alert(
      'Delete this?',
      `${personName ?? item.subject_name ?? 'This'} — ${labelFor(item!.subtype, -1).trim()}. `
        + 'It comes off the feed and out of the queue. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.from(table as never).delete().eq('id', item!.id);
            setBusy(false);
            if (error) {
              Alert.alert('Could not delete', error.message);
              return;
            }
            onChanged();
            onClose();
          },
        },
      ],
    );
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={2}>
              {item.subject_name}
              <Text style={styles.titleWhat}>{labelFor(item.subtype, -1)}</Text>
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>

          {!isAdmin ? (
            <Text style={styles.hint}>
              Only the admin can change or remove something once it is filed. Tell him
              what is wrong and he will fix it.
            </Text>
          ) : (
            <>
              <Text style={styles.label}>{isEventRow ? 'STARTS' : 'WHEN'}</Text>
              <DateField value={date} onChange={setDate} />
              {item.subtype === 'wedding' || item.subtype === 'child_wedding' ? (
                <Text style={styles.hint}>
                  Move it back into the future and it stops reading as married, and
                  drops out of the announcements.
                </Text>
              ) : null}

              {isVisitRow ? (
                <>
                  <Text style={styles.label}>LAST NIGHT</Text>
                  <DateField
                    value={until}
                    onChange={setUntil}
                    placeholder="Leave to keep as it is"
                  />
                </>
              ) : null}

              <Text style={styles.label}>NOTE</Text>
              <TextInput
                style={styles.note}
                value={note}
                onChangeText={setNote}
                multiline
                placeholder="Anything worth remembering"
                placeholderTextColor={colors.muted}
              />

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, !changed && styles.btnOff]}
                  disabled={!changed || busy}
                  onPress={save}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.navy900} size="small" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Save the change</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnBad]} disabled={busy} onPress={remove}>
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ff8a80" />
                  <Text style={styles.btnBadText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {item.person_id && onOpenPerson ? (
            <TouchableOpacity
              style={styles.openRow}
              onPress={() => {
                onClose();
                onOpenPerson(item.person_id!);
              }}
            >
              <MaterialCommunityIcons name="account-outline" size={16} color={colors.cyan} />
              <Text style={styles.openText}>Open his record</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.navy900,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: space.md,
    paddingBottom: space.lg,
    gap: 6,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  title: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: colors.white },
  titleWhat: { fontFamily: 'Poppins_400Regular', color: colors.muted },
  close: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: colors.muted, paddingTop: 3 },
  label: { ...type.label, color: colors.cyan, marginTop: space.sm, marginBottom: 6 },
  hint: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.75 },
  note: {
    minHeight: 62,
    textAlignVertical: 'top',
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  btnOff: { opacity: 0.35 },
  btnPrimary: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  btnPrimaryText: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: colors.navy900 },
  btnBad: { borderColor: 'rgba(255,138,128,0.45)' },
  btnBadText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#ff8a80' },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.ruleOnNavy,
  },
  openText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: colors.cyan },
});
