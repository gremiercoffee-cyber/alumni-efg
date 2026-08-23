import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { AlumniRecord } from '../lib/alumni';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * Edit a man's record.
 *
 * An admin's change is written straight away. Anyone else files a proposal --
 * one row per field, so a good correction and a bad guess in the same form can
 * be decided separately rather than all or nothing.
 *
 * Only fields that were actually touched are sent. Writing back every field on
 * every save would overwrite a value someone else changed while this form was
 * open, and would bury the real edit in a wall of no-ops on the review screen.
 */

type FieldSpec = {
  key: keyof AlumniRecord & string;
  label: string;
  keyboard?: 'default' | 'email-address' | 'phone-pad';
  multiline?: boolean;
};

const GROUPS: [string, FieldSpec[]][] = [
  ['NAME', [
    { key: 'first_name', label: 'First name' },
    { key: 'last_name', label: 'Last name' },
    { key: 'nickname', label: 'Nickname' },
  ]],
  ['REACHING HIM', [
    { key: 'phone', label: 'Phone', keyboard: 'phone-pad' },
    { key: 'email', label: 'Email', keyboard: 'email-address' },
  ]],
  ['WHERE HE IS', [
    { key: 'street_address', label: 'Street' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'zip_code', label: 'Postcode' },
    { key: 'country', label: 'Country' },
  ]],
  ['LIFE', [
    // Nothing in either old workbook recorded a birthday, so every one of these
    // is typed in by hand. Written as a plain date rather than a picker because
    // it is usually copied off a message, and a calendar 30 years back is a lot
    // of tapping.
    { key: 'birthday', label: 'Birthday (YYYY-MM-DD)' },
    { key: 'high_school', label: 'High school' },
    { key: 'marital_status', label: 'Marital status' },
    { key: 'spouse_name', label: "Wife's name" },
  ]],
  // Where he went after Aish. College for most, yeshiva for the ones still
  // learning, grad school later, and what he does now.
  ['POST-AISH', [
    { key: 'college', label: 'College' },
    { key: 'yeshiva', label: 'Yeshiva' },
    { key: 'grad_school', label: 'Graduate school' },
    { key: 'occupation', label: 'Occupation / doing now' },
  ]],
  ['NOTES', [{ key: 'notes', label: 'Notes', multiline: true }]],
];

const ALL = GROUPS.flatMap(([, f]) => f);

export default function PersonEditScreen({
  person,
  isAdmin,
  onBack,
  onSaved,
}: {
  person: AlumniRecord;
  isAdmin: boolean;
  onBack: () => void;
  onSaved: () => void;
}) {
  const original = useMemo(
    () =>
      Object.fromEntries(
        ALL.map((f) => [f.key, ((person as Record<string, unknown>)[f.key] as string) ?? '']),
      ) as Record<string, string>,
    [person],
  );

  const [values, setValues] = useState<Record<string, string>>(original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = ALL.filter((f) => (values[f.key] ?? '') !== (original[f.key] ?? ''));

  async function save() {
    if (!changed.length) return onBack();
    setBusy(true);
    setError(null);

    try {

      if (isAdmin) {
        const patch = Object.fromEntries(
          changed.map((f) => [f.key, values[f.key].trim() || null]),
        );
        const { error } = await supabase
          .from('people')
          .update(patch as never)
          .eq('id', person.id);
        if (error) throw error;
      } else {
        // Applies immediately. The admin is told in the daily summary, not asked
        // to approve -- a contact detail is a fact, not an announcement.
        const changes = Object.fromEntries(
          changed.map((f) => [f.key, values[f.key].trim() || null]),
        );
        const { error } = await supabase.rpc('edit_person' as never, {
          p_person_id: person.id,
          p_changes: changes,
        } as never);
        if (error) throw error;
      }

      onSaved();
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.head}>
        <TouchableOpacity onPress={onBack} hitSlop={10}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {person.name}
        </Text>
        <TouchableOpacity
          onPress={save}
          disabled={busy || !changed.length}
          hitSlop={10}
          style={!changed.length && styles.saveOff}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.cyan} />
          ) : (
            <Text style={styles.save}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {!isAdmin ? (
        <Text style={styles.notice}>
          Changes save right away. The alumni director is notified — no need to wait.
        </Text>
      ) : null}

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {GROUPS.map(([group, fields]) => (
          <View key={group} style={styles.group}>
            <Text style={styles.groupTitle}>{group}</Text>
            {fields.map((f) => {
              const dirty = (values[f.key] ?? '') !== (original[f.key] ?? '');
              return (
                <View key={f.key} style={styles.field}>
                  <Text style={[styles.label, dirty && styles.labelDirty]}>
                    {f.label}
                    {dirty ? ' · changed' : ''}
                  </Text>
                  <TextInput
                    style={[styles.input, f.multiline && styles.inputTall, dirty && styles.inputDirty]}
                    value={values[f.key]}
                    onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                    placeholder="—"
                    placeholderTextColor={colors.mutedDark}
                    keyboardType={f.keyboard ?? 'default'}
                    autoCapitalize={f.keyboard === 'email-address' ? 'none' : 'sentences'}
                    autoCorrect={false}
                    multiline={f.multiline}
                  />
                </View>
              );
            })}
          </View>
        ))}

        {/* Not editable here on purpose. Turning outreach back on for a man who
            asked not to be contacted should be a deliberate act, not something
            done in passing while fixing a postcode. */}
        {person.do_not_contact ? (
          <View style={styles.locked}>
            <MaterialIcons name="lock-outline" size={16} color={colors.bad} />
            <Text style={styles.lockedText}>
              He asked not to be contacted. That flag is not changed from here.
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ height: space.xxl }} />
      </ScrollView>

      {changed.length ? (
        <View style={styles.bar}>
          <Text style={styles.barText}>
            {changed.length} change{changed.length === 1 ? '' : 's'}: {changed.map((c) => c.label.toLowerCase()).join(', ')}
          </Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleOnNavy,
  },
  title: { flex: 1, textAlign: 'center', fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.white },
  cancel: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: colors.muted },
  save: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: colors.cyan },
  saveOff: { opacity: 0.3 },
  notice: {
    ...type.body,
    fontSize: 12.5,
    color: colors.warn,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  body: { padding: space.md, gap: space.lg },
  group: { gap: space.sm },
  groupTitle: { ...type.label, color: colors.cyan },
  field: { gap: 4 },
  label: { ...type.label, fontSize: 9.5, color: colors.muted, opacity: 0.75 },
  labelDirty: { color: colors.cyan, opacity: 1 },
  input: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14.5,
  },
  inputTall: { minHeight: 88, textAlignVertical: 'top' },
  inputDirty: { borderColor: colors.cyan },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,154,168,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,154,168,0.35)',
  },
  lockedText: { flex: 1, ...type.body, fontSize: 12.5, color: colors.bad },
  error: { ...type.body, fontSize: 13, color: colors.bad },
  bar: {
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.ruleOnNavy,
    backgroundColor: colors.navy800,
  },
  barText: { ...type.body, fontSize: 12, color: colors.muted },
});
