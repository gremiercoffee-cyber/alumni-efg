import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Badge, Empty } from '../components/ui';
import type { Directory } from '../lib/alumni';
import { announcementLink } from '../lib/contact';
import {
  EVENT_TYPES,
  inviteText,
  loadEvents,
  loadRoster,
  rsvpLink,
  type EventRow,
  type RosterRow,
} from '../lib/events';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * Events, their guest lists, and the link that fills them.
 *
 * Two screens in one: a list of events, and one event opened. Kept together
 * because the second is meaningless without the first and splitting them would
 * mean threading the whole event through props.
 */

export default function EventsScreen({
  directory,
  onChanged,
}: {
  directory: Directory | null;
  onChanged: () => void;
}) {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvents(await loadEvents());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.errTitle}>Could not load</Text>
        <Text style={styles.body}>{error}</Text>
      </ScrollView>
    );
  }
  if (!events) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  const open = events.find((e) => e.id === openId) ?? null;
  if (open) {
    return (
      <EventDetail
        ev={open}
        directory={directory}
        onBack={() => setOpenId(null)}
        onChanged={() => {
          void load();
          onChanged();
        }}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <TouchableOpacity style={styles.newBtn} onPress={() => setCreating(true)}>
        <MaterialCommunityIcons name="plus" size={17} color={colors.navy900} />
        <Text style={styles.newBtnText}>New event</Text>
      </TouchableOpacity>

      {!events.length ? (
        <Empty>No events yet. The shabbaton is a good first one.</Empty>
      ) : null}

      {events.map((ev) => (
        <TouchableOpacity key={ev.id} style={styles.card} onPress={() => setOpenId(ev.id)}>
          <View style={styles.cardHead}>
            <Text style={styles.name}>{ev.name}</Text>
            <Text style={styles.meta}>{ev.starts_on ?? 'no date'}</Text>
          </View>
          {ev.location ? <Text style={styles.body}>{ev.location}</Text> : null}
          <View style={styles.pills}>
            <Badge tone="cyan">{`${ev.heads} coming`}</Badge>
            {ev.via_link ? <Badge>{`${ev.via_link} by link`}</Badge> : null}
            {ev.unmatched ? <Badge tone="warn">{`${ev.unmatched} to attach`}</Badge> : null}
            {!ev.rsvp_open ? <Badge>RSVPs closed</Badge> : null}
          </View>
        </TouchableOpacity>
      ))}

      <NewEvent
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          void load().then(() => setOpenId(id));
          onChanged();
        }}
      />
    </ScrollView>
  );
}

/* -------------------------------------------------------------- new event */

function NewEvent({
  visible, onClose, onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('shabbaton');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const dated = /^\d{4}-\d{2}-\d{2}$/.test(startsOn);
  const ready = name.trim().length > 1 && dated;

  async function create() {
    setBusy(true);
    try {
      const { data: me } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('events')
        .insert({
          name: name.trim(),
          type: kind as never,
          // The year is derived, not asked for. One less field to get wrong,
          // and it is only ever the year the event happens in.
          year: Number(startsOn.slice(0, 4)),
          starts_on: startsOn,
          ends_on: /^\d{4}-\d{2}-\d{2}$/.test(endsOn) ? endsOn : null,
          location: location.trim() || null,
          description: description.trim() || null,
          created_by: me.user?.id ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      setName(''); setStartsOn(''); setEndsOn(''); setLocation(''); setDescription('');
      onCreated(data.id as number);
    } catch (e) {
      Alert.alert('Could not create', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>New event</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: space.lg }}>
            <Field label="WHAT IT IS CALLED">
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Alumni Shabbaton 2026"
                placeholderTextColor={colors.muted}
              />
            </Field>

            <Field label="KIND">
              <View style={styles.chips}>
                {EVENT_TYPES.map(([v, l]) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.chip, kind === v && styles.chipOn]}
                    onPress={() => setKind(v)}
                  >
                    <Text style={[styles.chipText, kind === v && styles.chipTextOn]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            <Field label="STARTS" hint="YYYY-MM-DD. The year is taken from this.">
              <TextInput
                style={styles.input}
                value={startsOn}
                onChangeText={setStartsOn}
                placeholder="2026-11-13"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
              />
            </Field>

            <Field label="ENDS" hint="Leave empty for a one-day event.">
              <TextInput
                style={styles.input}
                value={endsOn}
                onChangeText={setEndsOn}
                placeholder="2026-11-15"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
              />
            </Field>

            <Field label="WHERE">
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Aish Gesher, Old City"
                placeholderTextColor={colors.muted}
              />
            </Field>

            <Field label="ANYTHING ELSE" hint="This shows on the RSVP page as it is written.">
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Meals, times, what to bring…"
                placeholderTextColor={colors.muted}
              />
            </Field>

            <TouchableOpacity
              style={[styles.submit, !ready && styles.submitOff]}
              disabled={!ready || busy}
              onPress={create}
            >
              {busy ? (
                <ActivityIndicator color={colors.navy900} />
              ) : (
                <Text style={styles.submitText}>Create it</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------ one event */

function EventDetail({
  ev, directory, onBack, onChanged,
}: {
  ev: EventRow;
  directory: Directory | null;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [attaching, setAttaching] = useState<RosterRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setRoster(await loadRoster(ev.id));
    } catch (e) {
      Alert.alert('Could not load the list', e instanceof Error ? e.message : 'Unknown error');
    }
  }, [ev.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const link = rsvpLink(ev.rsvp_token);

  // Deliberately not expo-clipboard: it is a native module, so adding it would
  // mean a new APK rather than a 30-second update. On the web the browser's own
  // clipboard is enough; on the phone the link is selectable, and sharing the
  // whole message is the path that actually gets used anyway.
  const canCopy = Platform.OS === 'web' && typeof navigator !== 'undefined'
    && !!navigator.clipboard;

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareOnWhatsApp() {
    const url = announcementLink(inviteText(ev));
    if (Platform.OS === 'web') window.open(url, '_blank', 'noopener,noreferrer');
    else void Linking.openURL(url);
  }

  function shareByEmail() {
    const url =
      `mailto:?subject=${encodeURIComponent(ev.name)}` +
      `&body=${encodeURIComponent(inviteText(ev))}`;
    if (Platform.OS === 'web') window.location.assign(url);
    else void Linking.openURL(url);
  }

  async function toggleRsvp() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({ rsvp_open: !ev.rsvp_open })
        .eq('id', ev.id);
      if (error) throw error;
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  function resetLink() {
    Alert.alert(
      'Make a new link?',
      'The old link stops working straight away. Anyone who has it and has not '
        + 'answered yet will not be able to.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'New link',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('reset_rsvp_token', { p_event_id: ev.id });
            if (error) Alert.alert('Could not reset', error.message);
            else onChanged();
          },
        },
      ],
    );
  }

  async function add(personId: number) {
    setAdding(false);
    const { error } = await supabase
      .from('event_attendance')
      .insert({ event_id: ev.id, person_id: personId, source: 'admin' });
    if (error && !error.message.includes('duplicate')) {
      Alert.alert('Could not add', error.message);
      return;
    }
    await load();
    onChanged();
  }

  async function attachTo(personId: number) {
    const row = attaching;
    setAttaching(null);
    if (!row) return;
    const { error } = await supabase.rpc('attach_rsvp', {
      p_attendance_id: row.id,
      p_person_id: personId,
    });
    if (error) Alert.alert('Could not attach', error.message);
    await load();
    onChanged();
  }

  function remove(row: RosterRow) {
    Alert.alert('Take him off the list?', row.display_name, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('event_attendance').delete().eq('id', row.id);
          if (error) Alert.alert('Could not remove', error.message);
          await load();
          onChanged();
        },
      },
    ]);
  }

  async function setGuests(row: RosterRow, delta: number) {
    const next = Math.max(0, row.guests + delta);
    const { error } = await supabase
      .from('event_attendance')
      .update({ guests: next })
      .eq('id', row.id);
    if (error) Alert.alert('Could not save', error.message);
    await load();
    onChanged();
  }

  const unmatched = roster?.filter((r) => r.unmatched) ?? [];

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <TouchableOpacity onPress={onBack} style={styles.backRow}>
        <MaterialCommunityIcons name="chevron-left" size={18} color={colors.cyan} />
        <Text style={styles.backText}>All events</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{ev.name}</Text>
      <Text style={styles.body}>
        {[ev.starts_on, ev.ends_on && ev.ends_on !== ev.starts_on ? `to ${ev.ends_on}` : null,
          ev.location].filter(Boolean).join(' · ')}
      </Text>

      {/* ------------------------------------------------------ the link */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>THE RSVP LINK</Text>
        {link ? (
          <Text style={styles.link} selectable>{link}</Text>
        ) : (
          <Text style={styles.warn}>
            The website address is not set, so a link cannot be built here. It works
            on the website itself; on the phone it needs configuring once.
          </Text>
        )}
        <Text style={styles.hint}>
          Anyone with this link can say they are coming. They see the event and nothing
          else — not who else is on the list.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={shareOnWhatsApp}>
            <Text style={styles.btnPrimaryText}>Send on WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={shareByEmail}>
            <Text style={styles.btnText}>Email it</Text>
          </TouchableOpacity>
          {link && canCopy ? (
            <TouchableOpacity style={styles.btn} onPress={copyLink}>
              <Text style={styles.btnText}>{copied ? 'Copied' : 'Copy link'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btn} disabled={busy} onPress={toggleRsvp}>
            <Text style={styles.btnText}>
              {ev.rsvp_open ? 'Stop taking RSVPs' : 'Take RSVPs again'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={resetLink}>
            <Text style={styles.btnText}>New link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* -------------------------------------------------- to attach */}
      {unmatched.length ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>ANSWERED, BUT NOT RECOGNISED</Text>
          <Text style={styles.hint}>
            They typed an address that is not on anyone's record. They are counted
            either way — attaching them is what puts it on the man's history.
          </Text>
          {unmatched.map((r) => (
            <View key={r.id} style={styles.rowCard}>
              <View style={styles.flex}>
                <Text style={styles.rowName}>{r.display_name}</Text>
                <Text style={styles.rowMeta}>{r.email}</Text>
              </View>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => setAttaching(r)}
              >
                <Text style={styles.btnPrimaryText}>Attach</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => remove(r)}>
                <MaterialCommunityIcons name="close" size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {/* ----------------------------------------------------- the list */}
      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.blockTitle}>{`COMING · ${ev.heads}`}</Text>
          <TouchableOpacity onPress={() => setAdding(true)}>
            <Text style={styles.addText}>+ Add someone</Text>
          </TouchableOpacity>
        </View>

        {!roster ? (
          <ActivityIndicator color={colors.cyan} />
        ) : !roster.length ? (
          <Text style={styles.hint}>Nobody yet.</Text>
        ) : (
          roster
            .filter((r) => !r.unmatched)
            .map((r) => (
              <View key={r.id} style={styles.rowCard}>
                <View style={styles.flex}>
                  <Text style={styles.rowName}>{r.display_name}</Text>
                  <Text style={styles.rowMeta}>
                    {r.source === 'rsvp' ? 'answered the link' : 'added by you'}
                    {r.guests ? ` · +${r.guests}` : ''}
                  </Text>
                </View>
                {/* Guests, because a meal count is people not answers. */}
                <TouchableOpacity style={styles.iconBtn} onPress={() => setGuests(r, -1)}>
                  <MaterialCommunityIcons name="minus" size={16} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => setGuests(r, 1)}>
                  <MaterialCommunityIcons name="plus" size={16} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => remove(r)}>
                  <MaterialCommunityIcons name="close" size={16} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ))
        )}
      </View>

      <PersonPicker
        visible={adding || !!attaching}
        title={attaching ? `Who is ${attaching.display_name}?` : 'Add someone'}
        directory={directory}
        onClose={() => { setAdding(false); setAttaching(null); }}
        onPick={(id) => (attaching ? attachTo(id) : add(id))}
      />
    </ScrollView>
  );
}

/* ----------------------------------------------------------- shared bits */

function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function PersonPicker({
  visible, title, directory, onClose, onPick,
}: {
  visible: boolean;
  title: string;
  directory: Directory | null;
  onClose: () => void;
  onPick: (id: number) => void;
}) {
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (directory?.people ?? [])
      .filter((p) => !term || p.haystack.includes(term))
      .slice(0, 60);
  }, [q, directory]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder="Type to narrow…"
            placeholderTextColor={colors.muted}
            autoFocus
            autoCapitalize="none"
          />
          <FlatList
            data={items}
            keyExtractor={(p) => String(p.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.option}
                onPress={() => { setQ(''); onPick(item.id); }}
              >
                <Text style={styles.optionText}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  pad: { padding: space.lg, gap: space.sm },
  list: { padding: space.md, gap: space.sm + 4, paddingBottom: space.lg * 2 },
  errTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: colors.white },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: colors.white },
  body: { ...type.body, color: colors.muted },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  backText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.cyan },

  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingLeft: 11,
    paddingRight: 15,
    paddingVertical: 9,
  },
  newBtnText: { fontFamily: 'Poppins_700Bold', fontSize: 13.5, color: colors.navy900 },

  card: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    padding: space.md,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.white, flex: 1 },
  meta: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted, opacity: 0.8 },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },

  block: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
  },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockTitle: { ...type.label, color: colors.cyan },
  addText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: colors.cyan },
  link: { fontFamily: 'Poppins_500Medium', fontSize: 12.5, color: colors.white },
  warn: { ...type.body, fontSize: 13, color: colors.white, opacity: 0.9 },
  hint: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.75 },

  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.ruleOnNavy,
    paddingTop: 9,
    marginTop: 2,
  },
  rowName: { fontFamily: 'Poppins_500Medium', fontSize: 14.5, color: colors.white },
  rowMeta: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted, opacity: 0.8 },

  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  btn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.muted },
  btnPrimary: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  btnPrimaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.navy900 },
  iconBtn: { padding: 7 },

  field: { paddingHorizontal: space.md, paddingBottom: space.md },
  label: { ...type.label, color: colors.cyan, marginBottom: 7 },
  input: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    marginHorizontal: space.md,
  },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  chipText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: colors.muted },
  chipTextOn: { color: colors.navy900 },
  submit: {
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginHorizontal: space.md,
  },
  submitOff: { opacity: 0.35 },
  submitText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: colors.navy900 },

  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modal: {
    maxHeight: '86%',
    backgroundColor: colors.navy900,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  modalTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.white, flex: 1 },
  close: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: colors.muted },
  option: {
    paddingHorizontal: space.md,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: colors.ruleOnNavy,
  },
  optionText: { fontFamily: 'Poppins_400Regular', fontSize: 14.5, color: colors.white },
});
