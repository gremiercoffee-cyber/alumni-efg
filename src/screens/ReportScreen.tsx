import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Directory } from '../lib/alumni';
import {
  ALUMNUS_TYPES,
  NEEDS_DATE,
  REBBE_TYPES,
  isVisit,
  reportSimcha,
  type SimchaType,
} from '../lib/simchas';
import { colors, radius, space, type } from '../theme';

/**
 * Report a simcha: who, or which rebbe, and what happened.
 *
 * The pickers are searchable rather than raw dropdowns -- 723 names in a native
 * picker wheel is unusable. Choosing an alumnus clears the rebbe and vice versa,
 * because a simcha belongs to one person.
 */
export default function ReportScreen({
  directory,
  isAdmin,
  onDone,
}: {
  directory: Directory | null;
  isAdmin: boolean;
  onDone: () => void;
}) {
  const [personId, setPersonId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [simchaType, setSimchaType] = useState<SimchaType | ''>('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<null | 'person' | 'staff' | 'type'>(null);

  const types = staffId ? REBBE_TYPES : ALUMNUS_TYPES;
  const needsDate = simchaType
    ? NEEDS_DATE.includes(simchaType) || isVisit(simchaType)
    : false;
  const ready = (personId || staffId) && simchaType && (!needsDate || /^\d{4}-\d{2}-\d{2}$/.test(date));

  const personName = personId ? directory?.byId.get(personId)?.name ?? '' : '';
  const staffName = staffId ? directory?.staff.find((s) => s.id === staffId)?.name ?? '' : '';
  const typeLabel = types.find(([v]) => v === simchaType)?.[1] ?? '';

  async function submit() {
    if (!ready || !simchaType) return;
    setBusy(true);
    setError(null);
    try {
      const { committed } = await reportSimcha({
        isAdmin,
        personId,
        staffId,
        type: simchaType,
        date: needsDate ? date : date || new Date().toISOString().slice(0, 10),
      });
      setResult(
        isVisit(simchaType)
          ? `Recorded. ${personName} — ${typeLabel.toLowerCase()}.`
          : committed
            ? `Posted. ${personName || staffName} — ${typeLabel.toLowerCase()}. Staff are being notified.`
            : `Filed for review. ${personName || staffName} — ${typeLabel.toLowerCase()}.`,
      );
      setPersonId(null); setStaffId(null); setSimchaType(''); setDate('');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not file that.');
    } finally {
      setBusy(false);
    }
  }

  const Field = ({ label, value, placeholder, onPress, hint }: {
    label: string; value: string; placeholder: string; onPress: () => void; hint?: string;
  }) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.select} onPress={onPress}>
        <Text style={value ? styles.selectVal : styles.selectPlaceholder}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Field
        label="ALUMNUS"
        value={personName}
        placeholder="Search alumni…"
        onPress={() => setPicking('person')}
      />
      <Field
        label="OR A REBBE"
        value={staffName}
        placeholder="Search rebbeim…"
        onPress={() => setPicking('staff')}
        hint="Picking one clears the other — a simcha belongs to one person."
      />
      <Field
        label="WHAT HAPPENED"
        value={typeLabel}
        placeholder="Choose…"
        onPress={() => setPicking('type')}
        hint={staffId ? 'Rebbe list.' : 'Alumnus list.'}
      />

      {needsDate ? (
        <View style={styles.field}>
          <Text style={styles.label}>
            {isVisit(simchaType as SimchaType) ? 'WHEN' : 'WEDDING DATE'}
          </Text>
          <TextInput
            style={styles.select}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Text style={styles.hint}>
            {isVisit(simchaType as SimchaType)
              ? 'A date ahead of today reads as a plan; one behind reads as a record.'
              : 'This is the piece that was always missing. Until it is known, no '
                + 'reminder can be scheduled.'}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.submit, !ready && styles.submitOff]}
        disabled={!ready || busy}
        onPress={submit}
      >
        {busy ? (
          <ActivityIndicator color={colors.navy900} />
        ) : (
          <Text style={styles.submitText}>Report it</Text>
        )}
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result ? (
        <View style={styles.result}>
          <Text style={styles.resultText}>{result}</Text>
          {!isAdmin && !isVisit(simchaType as SimchaType) ? (
            <Text style={styles.resultNote}>
              The admin reviews it before it goes anywhere. If ten rebbeim report the same
              thing, he still only gets one notification.
            </Text>
          ) : null}
        </View>
      ) : null}

      <Picker
        mode={picking}
        directory={directory}
        types={types}
        onClose={() => setPicking(null)}
        onPerson={(id) => { setPersonId(id); setStaffId(null); setSimchaType(''); setPicking(null); }}
        onStaff={(id) => { setStaffId(id); setPersonId(null); setSimchaType(''); setPicking(null); }}
        onType={(v) => { setSimchaType(v); setDate(''); setPicking(null); }}
      />
    </ScrollView>
  );
}

function Picker({
  mode, directory, types, onClose, onPerson, onStaff, onType,
}: {
  mode: null | 'person' | 'staff' | 'type';
  directory: Directory | null;
  types: [SimchaType, string][];
  onClose: () => void;
  onPerson: (id: number) => void;
  onStaff: (id: number) => void;
  onType: (v: SimchaType) => void;
}) {
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (mode === 'person')
      return (directory?.people ?? [])
        .filter((p) => !term || p.haystack.includes(term))
        .slice(0, 60)
        .map((p) => ({ id: p.id, label: p.name }));
    if (mode === 'staff')
      return (directory?.staff ?? [])
        .filter((s) => !term || s.name.toLowerCase().includes(term))
        .map((s) => ({ id: s.id, label: s.name }));
    return types.map(([v, l]) => ({ id: v as unknown as number, label: l }));
  }, [mode, q, directory, types]);

  return (
    <Modal visible={!!mode} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>
              {mode === 'person' ? 'Choose an alumnus' : mode === 'staff' ? 'Choose a rebbe' : 'What happened'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.backText}>Close</Text>
            </TouchableOpacity>
          </View>
          {mode !== 'type' ? (
            <TextInput
              style={styles.search}
              value={q}
              onChangeText={setQ}
              placeholder="Type to narrow…"
              placeholderTextColor={colors.muted}
              autoFocus
              autoCapitalize="none"
            />
          ) : null}
          <FlatList
            data={items}
            keyExtractor={(i) => String(i.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.option}
                onPress={() =>
                  mode === 'person' ? onPerson(item.id)
                    : mode === 'staff' ? onStaff(item.id)
                    : onType(item.id as unknown as SimchaType)
                }
              >
                <Text style={styles.optionText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: { paddingHorizontal: space.md, paddingBottom: space.md },
  label: { ...type.label, color: colors.cyan, marginBottom: 7 },
  select: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  selectVal: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: colors.white },
  selectPlaceholder: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: colors.muted, opacity: 0.7 },
  hint: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.7, marginTop: 6 },
  submit: {
    marginHorizontal: space.md,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitOff: { opacity: 0.35 },
  submitText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: colors.navy900 },
  error: { ...type.body, color: colors.bad, padding: space.md },
  result: {
    margin: space.md,
    padding: 13,
    borderRadius: radius.md,
    backgroundColor: 'rgba(47,224,210,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(47,224,210,0.35)',
    gap: space.sm,
  },
  resultText: { ...type.body, color: colors.white },
  resultNote: { ...type.body, fontSize: 13, color: colors.muted },
  modalWrap: { flex: 1, backgroundColor: 'rgba(6,20,55,0.75)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.navy900,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '80%',
    paddingTop: space.md,
  },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  modalTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: colors.white },
  backText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: colors.cyan },
  search: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  option: {
    paddingHorizontal: space.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(27,58,114,0.5)',
  },
  optionText: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: colors.white },
});
