import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Empty } from '../components/ui';
import { letStaffKnow } from '../lib/staff';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * What has changed on alumni records lately.
 *
 * Profile edits apply on their own now, so this is the being-told half of that:
 * a log the admin reads rather than a queue he works. Each change carries a
 * "Let staff know" button, for the ones worth passing on -- a move, a new job.
 */

type Change = {
  id: number;
  person_id: number;
  subject_name: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: string;
};

const LABEL: Record<string, string> = {
  first_name: 'first name', last_name: 'last name', nickname: 'nickname',
  email: 'email', phone: 'phone', street_address: 'address', city: 'city',
  state: 'state', zip_code: 'postcode', country: 'country',
  high_school: 'high school', college: 'college', grad_school: 'grad school',
  occupation: 'occupation', marital_status: 'marital status',
  spouse_name: "wife's name", notes: 'notes', birthday: 'birthday',
};

function ago(iso: string) {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export default function RecentChangesScreen() {
  const [rows, setRows] = useState<Change[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('recent_profile_changes')
      .select('*')
      .limit(200);
    if (error) setError(error.message);
    else setRows((data ?? []) as Change[]);
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
  if (!rows) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }
  if (!rows.length) {
    return <Empty>No changes yet. Edits people make will show up here.</Empty>;
  }

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.blurb}>
        These already saved. Tap "Let staff know" on anything the rebbeim should hear.
      </Text>
      {rows.map((c) => {
        const field = LABEL[c.field] ?? c.field;
        const val = c.new_value || '—';
        return (
          <View key={c.id} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.name}>{c.subject_name}</Text>
              <Text style={styles.meta}>{ago(c.changed_at)}</Text>
            </View>
            <Text style={styles.what}>
              <Text style={styles.field}>{field}</Text>
              {'  '}
              {c.old_value ? (
                <Text style={styles.old}>{c.old_value} → </Text>
              ) : null}
              <Text style={styles.newv}>{val}</Text>
            </Text>
            <Text style={styles.by}>by {c.changed_by}</Text>

            <TouchableOpacity
              style={styles.tell}
              onPress={() =>
                letStaffKnow(
                  `Update: ${c.subject_name}`,
                  `${c.subject_name}'s ${field} is now ${val}.`,
                  c.person_id,
                )
              }
            >
              <MaterialCommunityIcons name="email-fast-outline" size={15} color={colors.cyan} />
              <Text style={styles.tellText}>Let staff know</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: space.lg, gap: space.sm },
  body: { ...type.body, color: colors.muted },
  errTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: colors.white },
  list: { padding: space.md, gap: space.sm + 4 },
  blurb: { ...type.body, fontSize: 13, color: colors.muted, opacity: 0.8 },
  card: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontFamily: 'Poppins_600SemiBold', fontSize: 15.5, color: colors.white },
  meta: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted, opacity: 0.8 },
  what: { ...type.body, color: colors.muted },
  field: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: colors.cyan, textTransform: 'uppercase' },
  old: { color: colors.muted, opacity: 0.7, textDecorationLine: 'line-through' },
  newv: { color: colors.white, fontFamily: 'Poppins_500Medium' },
  by: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted, opacity: 0.7 },
  tell: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tellText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: colors.cyan },
});
