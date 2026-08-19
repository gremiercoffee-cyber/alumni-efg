import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge, Empty, Prose } from '../components/ui';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';

/**
 * Who has signed in and is waiting to be let in.
 *
 * Google sign-in is configured as an External app, so any Google account on
 * earth can complete a sign-in. Landing in `pending` -- which grants nothing --
 * is what stops that being a problem, and this is where it gets undone
 * deliberately. Until now it could only be done in SQL.
 *
 * Admin cannot be granted here. set_user_role refuses it outright, so a
 * compromised session cannot quietly mint more admins.
 */

type Waiting = {
  id: string;
  email: string | null;
  display_name: string | null;
  signed_up_at: string | null;
  claimed_staff_id: number | null;
  claimed_staff_name: string | null;
  proposed_staff_name: string | null;
};

const ROLES: [string, string, string][] = [
  ['staff', 'Staff', 'Can see everything and record visits, contacts and reports.'],
  ['viewer', 'Viewer', 'Can see everything. Cannot change anything.'],
];

export default function PendingUsersScreen({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<Waiting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('pending_users')
      .select('*')
      .order('signed_up_at', { ascending: false });
    if (error) setError(error.message);
    else {
      // The generated types predate migration 0028, which adds the claim
      // columns to this view.
      setRows((data ?? []) as unknown as Waiting[]);
      setError(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(user: Waiting, role: string | null) {
    setBusy(user.id);
    try {
      if (role) {
        const { error } = await supabase.rpc('set_user_role', {
          // Approving also attaches him to the rebbe he said he was. Doing it
          // in one call means he cannot be let in and left unlinked -- which
          // would be a rebbe with no alumni and no weekly email.
          p_staff_id: user.claimed_staff_id ?? null,
          // Null unless he wrote his own name in, in which case approving is
          // also what creates his staff record.
          p_new_staff_name: user.proposed_staff_name ?? null,
          p_user: user.id,
          p_role: role as never,
        });
        if (error) throw error;
      } else {
        // Refusing leaves them pending rather than deleting the account: they
        // may be a rebbe who signed in before you were expecting him.
        Alert.alert(
          'Left waiting',
          `${user.email} stays pending and can still see nothing.`,
        );
      }
      await load();
      onChanged();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.errTitle}>Could not load</Text>
        <Prose>{error}</Prose>
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
    return <Empty>Nobody is waiting for access.</Empty>;
  }

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.blurb}>
        Anyone with a Google account can sign in. Until you give them a role they see
        nothing at all.
      </Text>

      {rows.map((u) => (
        <View key={u.id} style={styles.card}>
          <Text style={styles.name}>{u.display_name || u.email}</Text>
          {u.display_name && u.email ? <Text style={styles.email}>{u.email}</Text> : null}

          {/* Who he says he is. The email rarely says it, and getting this wrong
              hands one rebbe another's alumni. */}
          <Text style={u.claimed_staff_name || u.proposed_staff_name ? styles.claim : styles.claimNone}>
            {u.claimed_staff_name
              ? `Says he is ${u.claimed_staff_name}`
              : u.proposed_staff_name
              ? `Says he is ${u.proposed_staff_name} — not on the list`
              : 'Has not said which rebbe he is'}
          </Text>
          {u.proposed_staff_name && !u.claimed_staff_name ? (
            <Text style={styles.claimNote}>
              Letting him in adds him to the staff list under that name. Fix the
              spelling first if it is wrong — everyone will see it.
            </Text>
          ) : null}
          {u.signed_up_at ? (
            <View style={styles.pills}>
              <Badge>
                {`signed in ${new Date(u.signed_up_at).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                })}`}
              </Badge>
            </View>
          ) : null}

          <View style={styles.roles}>
            {ROLES.map(([role, label, what]) => (
              <TouchableOpacity
                key={role}
                style={styles.role}
                disabled={busy === u.id}
                onPress={() => decide(u, role)}
              >
                {busy === u.id ? (
                  <ActivityIndicator size="small" color={colors.cyan} />
                ) : (
                  <>
                    <Text style={styles.roleLabel}>{label}</Text>
                    <Text style={styles.roleWhat}>{what}</Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.footnote}>
        Admin is deliberately not offered here. It is granted in the Supabase dashboard,
        so a session that is not yours cannot create more admins.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  claimNote: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11.5,
    color: colors.muted,
    opacity: 0.75,
    marginTop: 2,
  },
  claim: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.cyan, marginTop: 4 },
  claimNone: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12.5,
    color: colors.muted,
    opacity: 0.75,
    marginTop: 4,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: space.lg, gap: space.sm },
  errTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: colors.white },
  list: { padding: space.md, gap: space.sm + 4 },
  blurb: { ...type.body, fontSize: 13, color: colors.muted, opacity: 0.8, marginBottom: 4 },
  card: {
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    padding: space.md,
    gap: 5,
  },
  name: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.white },
  email: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.muted, opacity: 0.8 },
  pills: { flexDirection: 'row', gap: 6, marginTop: 2 },
  roles: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  role: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
    minHeight: 62,
    justifyContent: 'center',
  },
  roleLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: colors.cyan },
  roleWhat: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: colors.muted, opacity: 0.8 },
  footnote: {
    ...type.body,
    fontSize: 11.5,
    color: colors.muted,
    opacity: 0.6,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
