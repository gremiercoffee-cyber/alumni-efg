import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
 * Say what happened, and file it. One button.
 *
 * Tap the mic, talk, tap to stop. It writes down what it heard, works out what
 * you meant, and shows it back -- "is this right?" -- before anything is saved.
 * Yes files it, No throws it away. Never files without being shown first: the
 * point is not to save the taps, it is to save the thinking about which screen
 * a thing belongs on.
 *
 * The web has no microphone here, so it falls back to a box you type into. A
 * name the database cannot resolve to one man is offered as a choice rather
 * than guessed -- there are two unrelated Avi Greens.
 */

type Stage = 'idle' | 'recording' | 'thinking' | 'confirm' | 'filing';

export default function FilerSheet({
  visible,
  onClose,
  onFiled,
}: {
  visible: boolean;
  onClose: () => void;
  onFiled: () => void;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [heard, setHeard] = useState('');
  const [text, setText] = useState(''); // web typing
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [chosen, setChosen] = useState<Record<number, number>>({});
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [unclear, setUnclear] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Fresh every time it opens; never leave a half-finished note lying around.
  useEffect(() => {
    if (!visible) return;
    reset();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    void cancelDictation();
    setStage('idle');
    setHeard('');
    setText('');
    setProposals([]);
    setChosen({});
    setSkipped(new Set());
    setUnclear(null);
    setError(null);
    setDone(null);
  }

  async function startRec() {
    setError(null);
    setDone(null);
    try {
      await startDictation();
      setStage('recording');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start recording.');
      setStage('idle');
    }
  }

  // Stop, transcribe, and read it -- all one step, so there is nothing else to
  // press. What it understood is shown next for a yes or no.
  async function stopAndRead() {
    setStage('thinking');
    setError(null);
    try {
      const said = await stopDictation();
      setHeard(said);
      await parse(said);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not hear that.');
      setStage('idle');
    }
  }

  // The web path: read what was typed.
  async function readTyped() {
    if (!text.trim()) return;
    setHeard(text.trim());
    setStage('thinking');
    setError(null);
    await parse(text.trim());
  }

  async function parse(sentence: string) {
    try {
      const result = await readNote(sentence);
      setProposals(result.proposals);
      setUnclear(result.unclear);
      setChosen(
        Object.fromEntries(
          result.proposals
            .map((p, i) => [i, p.match?.id])
            .filter(([, id]) => id != null) as [number, number][],
        ),
      );
      if (result.proposals.length) {
        setStage('confirm');
      } else {
        setStage('idle');
        setError(
          result.unclear
            ? `Not sure what to do with "${result.unclear}". Try saying it again.`
            : 'Nothing in that looked like something to file.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that.');
      setStage('idle');
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
      setProposals([]);
      setHeard('');
      setText('');
      setStage('idle');
    }
  }

  const ready = proposals.some((_, i) => !skipped.has(i) && chosen[i]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />

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

          {/* ----------------------------------------------- talk / thinking */}
          {stage !== 'confirm' && stage !== 'filing' ? (
            canDictate ? (
              <View style={styles.micWrap}>
                {stage === 'thinking' ? (
                  <>
                    <ActivityIndicator size="large" color={colors.cyan} />
                    <Text style={styles.micHint}>Reading it…</Text>
                  </>
                ) : stage === 'recording' ? (
                  <>
                    <TouchableOpacity style={[styles.bigMic, styles.bigMicOn]} onPress={stopAndRead}>
                      <MaterialIcons name="stop" size={40} color={colors.navy900} />
                    </TouchableOpacity>
                    <Text style={styles.micHint}>Listening… tap to stop</Text>
                    <TouchableOpacity onPress={reset} hitSlop={8}>
                      <Text style={styles.cancel}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.bigMic} onPress={startRec}>
                      <MaterialIcons name="mic" size={40} color={colors.navy900} />
                    </TouchableOpacity>
                    <Text style={styles.micHint}>Tap and say what happened</Text>
                    {done ? <Text style={styles.done}>{done}</Text> : null}
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                  </>
                )}
              </View>
            ) : (
              // Web: no microphone, so type it.
              <View style={styles.typeWrap}>
                <TextInput
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  placeholder="Avi Kroll stayed over for Shabbos and gave me a new number, 054 123 4567"
                  placeholderTextColor={colors.mutedDark}
                  multiline
                  autoFocus
                  editable={stage === 'idle'}
                />
                {done ? <Text style={styles.done}>{done}</Text> : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <TouchableOpacity
                  style={[styles.primary, !text.trim() && styles.primaryOff]}
                  disabled={!text.trim() || stage === 'thinking'}
                  onPress={readTyped}
                >
                  {stage === 'thinking' ? (
                    <ActivityIndicator color={colors.navy900} size="small" />
                  ) : (
                    <Text style={styles.primaryText}>Read it</Text>
                  )}
                </TouchableOpacity>
              </View>
            )
          ) : null}

          {/* -------------------------------------------------- confirm */}
          {stage === 'confirm' || stage === 'filing' ? (
            <>
              {heard ? <Text style={styles.heard}>&ldquo;{heard}&rdquo;</Text> : null}
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
                                <Text style={[styles.pickText, pick === c.id && styles.pickTextOn]}>
                                  {c.name}
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
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </ScrollView>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.ghost} onPress={reset} disabled={stage === 'filing'}>
                  <Text style={styles.ghostText}>No, redo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primary, styles.grow, !ready && styles.primaryOff]}
                  disabled={!ready || stage === 'filing'}
                  onPress={file}
                >
                  {stage === 'filing' ? (
                    <ActivityIndicator color={colors.navy900} size="small" />
                  ) : (
                    <Text style={styles.primaryText}>Yes, file it</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,9,26,0.6)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
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

  // The mic, centred and big -- the one thing to press.
  micWrap: { alignItems: 'center', gap: 14, paddingVertical: space.xl, paddingHorizontal: space.md },
  bigMic: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  bigMicOn: { backgroundColor: '#ff8a80', shadowColor: '#ff8a80' },
  micHint: { fontFamily: 'Poppins_500Medium', fontSize: 14.5, color: colors.muted },
  cancel: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.muted, marginTop: 2 },

  typeWrap: { paddingHorizontal: space.md, gap: space.sm, paddingBottom: space.sm },
  input: {
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

  heard: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: colors.muted,
    fontStyle: 'italic',
    paddingHorizontal: space.md,
    paddingBottom: 4,
  },
  list: { paddingHorizontal: space.md, maxHeight: 360 },
  card: {
    backgroundColor: colors.navy900,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    gap: 6,
  },
  cardOff: { opacity: 0.4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardWhat: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 14.5, color: colors.white },
  who: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: colors.cyan },
  noMatch: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#ff8a80' },
  ambiguous: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.muted },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  pick: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pickOn: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  pickText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: colors.muted },
  pickTextOn: { color: colors.navy900 },
  unclear: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: colors.muted, opacity: 0.8, paddingVertical: 4 },

  actions: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm },
  grow: { flex: 1 },
  primary: {
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryOff: { opacity: 0.35 },
  primaryText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: colors.navy900 },
  ghost: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleOnNavy,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  ghostText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: colors.muted },
  error: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#ff8a80', textAlign: 'center', paddingTop: 6 },
  done: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: colors.cyan, textAlign: 'center', paddingTop: 6 },
});
