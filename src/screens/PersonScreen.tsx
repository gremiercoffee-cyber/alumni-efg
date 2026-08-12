import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Badge, Prose, Section } from '../components/ui';
import type { AlumniRecord } from '../lib/alumni';
import { reachByEmail, reachByPhone } from '../lib/contact';
import { colors, radius, space, type } from '../theme';

export default function PersonScreen({
  person,
  onBack,
  onContacted,
}: {
  person: AlumniRecord;
  onBack: () => void;
  onContacted: () => void;
}) {
  const dnc = person.do_not_contact;
  const life = [
    person.college,
    person.occupation,
    person.spouse_name ? `Married to ${person.spouse_name}` : null,
    [person.city, person.country].filter(Boolean).join(', ') || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.flex}>
      <TouchableOpacity onPress={onBack} style={styles.back} accessibilityRole="button">
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>

      <ScrollView>
        <View style={styles.head}>
          <Text style={styles.name}>{person.name}</Text>
          {person.aliases.length ? (
            <Text style={styles.alias}>also recorded as {person.aliases.join(', ')}</Text>
          ) : null}
          <View style={styles.badges}>
            {person.levels.map((l) => (
              <Badge key={l} tone="cyan">{l}</Badge>
            ))}
            {person.spotlight ? <Badge tone="warn">Spotlight</Badge> : null}
            {dnc ? <Badge tone="bad">Do not contact</Badge> : null}
          </View>
        </View>

        {/* First, and unmissable. This instruction was buried in a notes column
            where anything automated would have driven straight past it. */}
        {dnc ? (
          <Section title="WHY HE IS FLAGGED">
            <Prose>{person.do_not_contact_reason || 'Asked not to be contacted.'}</Prose>
          </Section>
        ) : null}

        <Section title="REACH HIM">
          <TouchableOpacity
            style={[styles.tap, (dnc || !person.phone) && styles.tapOff]}
            disabled={dnc || !person.phone}
            onPress={() => reachByPhone(person, onContacted)}
          >
            <FontAwesome name="whatsapp" size={20} color={colors.whatsapp} />
            <Text style={styles.tapVal} numberOfLines={1}>
              {person.phone || 'No number on file'}
            </Text>
            <Text style={styles.tapGo}>{person.phone ? 'WhatsApp' : ''}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tap, (dnc || !person.email) && styles.tapOff]}
            disabled={dnc || !person.email}
            onPress={() => reachByEmail(person, onContacted)}
          >
            <MaterialIcons name="mail-outline" size={19} color={colors.cyan} />
            <Text style={styles.tapVal} numberOfLines={1}>
              {person.email || 'No email on file'}
            </Text>
            <Text style={styles.tapGo}>{person.email ? 'Email' : ''}</Text>
          </TouchableOpacity>
        </Section>

        <Section title="IN THE PROGRAM">
          {person.enrolments.length ? (
            person.enrolments.map((e) => (
              <View key={`${e.year}-${e.level}`} style={styles.tl}>
                <Text style={styles.tlYear}>{e.year}</Text>
                <Text style={styles.tlVal}>{e.level ?? '—'}</Text>
              </View>
            ))
          ) : (
            <Prose>Not recorded.</Prose>
          )}
        </Section>

        <Section title="ALUMNI SHABBATON">
          {person.shabbatons.length ? (
            <View style={styles.pills}>
              {person.shabbatons.map((y) => (
                <Badge key={y} tone="cyan">{y}</Badge>
              ))}
            </View>
          ) : (
            <Prose>—</Prose>
          )}
        </Section>

        {/* Two different claims, and they disagree for 208 of the 723. Merging
            them would hide exactly the thing worth seeing. */}
        <Section title="HIS REBBE IN THE PROGRAM" footnote="From the alumni database — who his rebbe was.">
          {person.programRebbeim.length ? (
            person.programRebbeim.map((r) => (
              <View key={`${r.year}-${r.rebbe}`} style={styles.tl}>
                <Text style={styles.tlYear}>{r.year}</Text>
                <Text style={styles.tlVal}>{r.rebbe}</Text>
                {person.mutual.includes(r.rebbe) ? <Badge tone="cyan">also close</Badge> : null}
              </View>
            ))
          ) : (
            <Prose>Not recorded.</Prose>
          )}
        </Section>

        <Section
          title="REBBEIM WHO SAY THEY ARE CLOSE WITH HIM"
          footnote="From the rebbeim's own sheet — their answer, not his."
        >
          {person.claimedBy.length ? (
            <View style={styles.pills}>
              {person.claimedBy.map((r) => (
                <Badge key={r} tone={person.mutual.includes(r) ? 'cyan' : 'plain'}>{r}</Badge>
              ))}
            </View>
          ) : (
            <Prose>Nobody has claimed him.</Prose>
          )}
        </Section>

        <Section title="CONTACT HISTORY">
          <Prose>
            {person.lastContactedOn
              ? `Last reached out ${new Date(`${person.lastContactedOn}T00:00:00`)
                  .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.`
              : 'Nobody has reached out through the app yet.'}
          </Prose>
        </Section>

        <Section title="LIFE">
          <Prose>{life || 'Nothing on file yet.'}</Prose>
        </Section>

        {person.learning_post_gesher || person.aish_impact ? (
          <Section title="LEARNING & IMPACT">
            <Prose>{person.learning_post_gesher || person.aish_impact}</Prose>
          </Section>
        ) : null}

        <View style={{ height: space.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { paddingHorizontal: space.md, paddingBottom: space.sm },
  backText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: colors.cyan },
  head: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleOnNavy,
  },
  name: { fontFamily: 'Poppins_700Bold', fontSize: 23, color: colors.white, letterSpacing: -0.4 },
  alias: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.muted, opacity: 0.8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm + 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tapOff: { opacity: 0.45 },
  tapVal: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 13.5, color: colors.white },
  tapGo: { ...type.label, fontSize: 9.5, color: colors.muted, opacity: 0.8 },
  tl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tlYear: {
    width: 78,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: colors.cyan,
  },
  tlVal: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, color: colors.white },
});
