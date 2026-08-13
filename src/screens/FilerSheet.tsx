import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { canDictate, cancelDictation, startDictation, stopDictation } from '../lib/dictate';
import { describe, fileOne, readNote, type Proposal } from '../lib/filer';
import { colors, radius, space, type } from '../theme';

/**
 * Say what happened, in a sentence, and file it.
 *
 * Three states in one sheet: write, confirm, done. It never files without being
 * shown first -- the point is not to save the two taps, it is to save the
 * thinking about which screen a thing belongs on.
 *
 * A name the database cannot resolve to one man is offered as a choice rather
 * than guessed. There are two unrelated Avi Greens.
 */

type Stage = 'write' | 'recording' | 'transcribing' | 'reading' | 'confirm' | 'filing';

export default function FilerSheet({
  visible,
  onClose,
  onFiled,
}: {
  visible: boolean;
  onClose: () => void;
  onFiled: () => void;
}) {
  const [stage, setStage] = useState<Stage>('write');
  const [text, setText] = useState('');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [chosen, setChosen] = useState<Record<number, number>>({});
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [unclear, setUnclear] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function record() {
    setError(null);
    setDone(null);
    try {
      await startDictation();
      setStage('recording');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start recording.');
    }
  }

  async function stopAndRead() {
    setStage('transcribing');
    try {
      const heard = await stopDictation();
      // Straight into the box rather than filing blind: a misheard word is far
      // easier to fix here than to unpick afterwards.
      const next = text.trim() ? `${text.trim()} ${heard}` : heard;
      setText(next);
      setStage('write');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not transcribe that.');
      setStage('write');
    }
  }

  async function discard() {
    await cancelDictation();
    setStage('write');
  }

  function reset() {
    void cancelDictation();
    setStage('write');
    setText('');
    setProposals([]);
    setChosen({});
    setSkipped(new Set());
    setUnclear(null);
    setError(null);
    setDone(null);
  }

  async function read() {
    if (!text.trim()) return;
    setStage('reading');
    setError(null);
    try {
      const result = await readNote(text.trim());
      setProposals(result.proposals);
      setUnclear(result.unclear);
      setChosen(
        Object.fromEntries(
          result.proposals
            .map((p, i) => [i, p.match?.id])
            .filter(([, id]) => id != null) as [number, number][],
        ),
      );
      setStage(result.proposals.length ? 'confirm' : 'write');
      if (!result.proposals.length && !result.unclear) {
        setError('Nothing in that looked like something to file.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that.');
      setStage('write');
    }
  }

  async function file() {
    setStage('filing');
    setError(null);
    const failures: string[] = [];
    let filed = 0;

    for (let i = 0; i < proposals.length; i++) {
      if (skipped.has(i)) continue;
      const personId = chosen[i];
      if (!personId) continue;
      try {
        await fileOne(proposals[i], personId);
        filed++;
      } catch (e) {
        failures.push(`${proposals[i].person_said}: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }

    onFiled();
    if (failures.length) {
      setError(failures.join('\n'));
      setStage('confirm');
    } else {
      setDone(`Filed ${filed} thing${filed === 1 ? '' : 's'}.`);
      setStage('write');
      setProposals([]);
      setText('');
    }
  }

  const ready = proposals.some((_, i) => !skipped.has(i) && chosen[i]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.grabber} />

            <View style={styles.head}>
              <Text style={styles.title}>
                {stage === 'confirm' ? 'Is this right?' : 'File something'}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <MaterialIcons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {stage !== 'confirm' && stage !== 'filing' ? (
              <>
                <TextInput
                  style={styles.input}
                  value={text}
                  onChangeText={(t) => {
                    setText(t);
                    setDone(null);
                  }}
                  placeholder="Avi Kroll stayed over for Shabbos and gave me a new number, 054 123 4567"
                  placeholderTextColor={colors.mutedDark}
                  multiline
                  editable={stage === 'write'}
                  autoFocus={canDictate ? false : true}
                  onSubmitEditing={read}
                />
                {canDictate ? (
                  <View style={styles.dictateRow}>
                    {stage === 'recording' ? (
                      <>
                        <TouchableOpacity style={styles.stop} onPress={stopAndRead}>
                          <MaterialIcons name="stop" size={18} color={colors.navy900} />
                          <Text style={styles.stopText}>Stop</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={discard} hitSlop={8}>
                          <Text style={styles.discard}>Discard</Text>
                        </TouchableOpacity>
                        <View style={styles.recDot} />
                        <Text style={styles.recText}>Listening</Text>
                      </>
                    ) : stage === 'transcribing' ? (
                      <>
                        <ActivityIndicator size="small" color={colors.cyan} />
                        <Text style={styles.recText}>Writing it down…</Text>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity style={styles.mic} onPress={record}>
                          <MaterialIcons name="mic" size={19} color={colors.navy900} />
                        </TouchableOpacity>
                        <Text style={styles.hint}>
                          {text.trim() ? 'Tap to add more' : 'Tap and say what happened'}
                        </Text>
                      </>
                    )}
                  </View>
                ) : (
                  <Text style={styles.hint}>
                    Use your keyboard&apos;s mic to dictate. Several things at once is fine.
                  </Text>
                )}
              </>
            ) : null}

            {stage === 'confirm' || stage === 'filing' ? (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {proposals.map((p, i) => {
                  const off = skipped.has(i);
                  const pick = chosen[i];
                  const options = p.match ? [p.match] : p.candidates;
                  return (
                    <View key={i} style={[styles.card, off && styles.cardOff]}>
                      <View style={styles.cardHead}>
                        <Text style={styles.cardWhat}>{describe(p)}</Text>
                        <TouchableOpacity
                          hitSlop={8}
                          onPress={() =>
                            setSkipped((s) => {
                              const n = new Set(s);
                              if (n.has(i)) n.delete(i);
                              else n.add(i);
                              return n;
                            })
                          }
                        >
                          <MaterialIcons
                            name={off ? 'add-circle-outline' : 'remove-circle-outline'}
                            size={19}
                            color={off ? colors.cyan : colors.muted}
                          />
                        </TouchableOpacity>
                      </View>

                      {!options.length ? (
                        <Text style={styles.noMatch}>
                          No one matches &ldquo;{p.person_said}&rdquo;. Skip it and add him first.
                        </Text>
                      ) : options.length === 1 ? (
                        <Text style={styles.who}>{options[0].name}</Text>
                      ) : (
                        <>
                          <Text style={styles.ambiguous}>
                            {options.length} people could be &ldquo;{p.person_said}&rdquo;
                          </Text>
                          <View style={styles.picks}>
                            {options.map((c) => (
                              <TouchableOpacity
                                key={c.id}
                                style={[styles.pick, pick === c.id && styles.pickOn]}
                                onPress={() => setChosen((s) => ({ ...s, [i]: c.id }))}
                              >
                                <Text
                                  style={[styles.pickText, pick === c.id && styles.pickTextOn]}
                                >
                                  {c.name} · {c.id}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}

                {unclear ? <Text style={styles.unclear}>Not sure about: {unclear}</Text> : null}
              </ScrollView>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {done ? <Text style={styles.done}>{done}</Text> : null}

            <View style={styles.actions}>
              {stage === 'confirm' ? (
                <TouchableOpacity style={styles.ghost} onPress={reset}>
                  <Text style={styles.ghostText}>Start over</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.primary,
                  (stage === 'reading' || stage === 'filing') && styles.primaryBusy,
                  stage === 'confirm' && !ready && styles.primaryOff,
                ]}
                disabled={
                  stage === 'reading' ||
                  stage === 'filing' ||
                  stage === 'recording' ||
                  stage === 'transcribing' ||
                  (stage === 'write' && !text.trim()) ||
                  (stage === 'confirm' && !ready)
                }
                onPress={stage === 'confirm' ? file : read}
              >
                {stage === 'reading' || stage === 'filing' || stage === 'transcribing' ? (
                  <ActivityIndicator color={colors.navy900} size="small" />
                ) : (
                  <Text style={styles.primaryText}>
                    {stage === 'confirm' ? 'File it' : 'Read it'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,9,26,0.6)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheetWrap: { width: '100%' },
  sheet: {
    backgroundColor: colors.navy800,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: colors.ruleOnNavy,
    paddingBottom: space.lg,
    maxHeight: '86%',
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ruleOnNavy,
    marginTop: 10,
    marginBottom: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  title: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: colors.white },

  input: {
    marginHorizontal: space.md,
    backgroundColor: colors.navy900,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 96,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  dictateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    paddingHorizontal: space.md,
    paddingTop: 10,
  },
  mic: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bad,
    borderRadius: 19,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 9,
  },
  stopText: { fontFamily: 'Poppins_700Bold', fontSize: 13.5, color: colors.navy900 },
  discard: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: colors.muted },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bad, marginLeft: 'auto' },
  recText: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.muted },
  hint: {
    ...type.body,
    fontSize: 12,
    color: colors.muted,
    opacity: 0.65,
    paddingHorizontal: space.md,
    paddingTop: 8,
  },

  list: { paddingHorizontal: space.md, marginTop: 4 },
  card: {
    backgroundColor: colors.navy900,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    padding: 13,
    marginBottom: 8,
    gap: 5,
  },
  cardOff: { opacity: 0.4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardWhat: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: colors.white },
  who: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, color: colors.cyan },
  ambiguous: { ...type.body, fontSize: 12.5, color: colors.warn },
  noMatch: { ...type.body, fontSize: 12.5, color: colors.bad },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  pick: {
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pickOn: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  pickText: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.muted },
  pickTextOn: { fontFamily: 'Poppins_600SemiBold', color: colors.navy900 },
  unclear: { ...type.body, fontSize: 12.5, color: colors.warn, paddingVertical: 6 },

  error: { ...type.body, fontSize: 13, color: colors.bad, paddingHorizontal: space.md, paddingTop: 8 },
  done: { ...type.body, fontSize: 13, color: colors.cyan, paddingHorizontal: space.md, paddingTop: 8 },

  actions: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.md },
  primary: {
    flex: 1,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBusy: { opacity: 0.7 },
  primaryOff: { opacity: 0.35 },
  primaryText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: colors.navy900 },
  ghost: {
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  ghostText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: colors.muted },
});
