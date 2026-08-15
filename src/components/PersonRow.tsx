import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { AlumniRecord } from '../lib/alumni';
import { yearRange } from '../lib/alumni';
import { reachByEmail, reachByPhone } from '../lib/contact';
import { MineStar } from '../lib/mine';
import { colors, radius, space, type } from '../theme';
import { Avatar } from './ui';

/**
 * A row in the alumni list.
 *
 * WhatsApp and email sit on the row itself rather than only inside the card:
 * working down a list of men to call, opening each record first is a wasted tap
 * every time.
 */
export default function PersonRow({
  person,
  onOpen,
  onContacted,
}: {
  person: AlumniRecord;
  onOpen: () => void;
  onContacted: () => void;
}) {
  const sub = [person.city, person.occupation || person.college].filter(Boolean).join(' · ');
  const dnc = person.do_not_contact;

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.main} onPress={onOpen} accessibilityRole="button">
        <Avatar name={person.name} />
        <View style={styles.who}>
          <Text style={styles.name} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {sub || '—'}
          </Text>
        </View>
        {dnc ? <View style={[styles.dot, styles.dotDnc]} /> : null}
        {person.spotlight ? <View style={[styles.dot, styles.dotSpot]} /> : null}
        {!person.claimedBy.length ? (
          <Text style={styles.unclaimed}>unclaimed</Text>
        ) : null}
        <Text style={styles.years}>{yearRange(person.years)}</Text>
      </TouchableOpacity>

      <View style={styles.quick}>
        <MineStar personId={person.id} size={19} />
        <TouchableOpacity
          style={[styles.qb, styles.qbWa, (dnc || !person.phone) && styles.qbOff]}
          disabled={dnc || !person.phone}
          onPress={() => reachByPhone(person, onContacted)}
          accessibilityLabel={`Message ${person.name}`}
        >
          {person.phone ? (
            <FontAwesome name="whatsapp" size={18} color={colors.whatsapp} />
          ) : (
            <MaterialIcons name="phone" size={16} color={colors.muted} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.qb, (dnc || !person.email) && styles.qbOff]}
          disabled={dnc || !person.email}
          onPress={() => reachByEmail(person, onContacted)}
          accessibilityLabel={`Email ${person.name}`}
        >
          <MaterialIcons name="mail-outline" size={16} color={colors.cyan} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(27,58,114,0.5)',
    paddingRight: 10,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 4,
    paddingVertical: 11,
    paddingLeft: space.md,
    paddingRight: space.sm,
    minWidth: 0,
  },
  who: { flex: 1, minWidth: 0 },
  name: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: colors.white },
  sub: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, opacity: 0.75 },
  years: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: colors.muted },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotDnc: { backgroundColor: colors.bad },
  dotSpot: { backgroundColor: colors.warn },
  unclaimed: {
    ...type.label,
    fontSize: 8.5,
    color: colors.muted,
    opacity: 0.7,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  quick: { flexDirection: 'row', gap: 5 },
  qb: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    backgroundColor: colors.navy800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qbWa: { backgroundColor: 'rgba(37,211,102,0.14)' },
  qbOff: { opacity: 0.25 },
});
