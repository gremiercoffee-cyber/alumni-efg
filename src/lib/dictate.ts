import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Record a note and get it back as text.
 *
 * Native only. The web build has no microphone path here on purpose -- the
 * filer is for the phone, and a browser can be typed into.
 *
 * The recording is never stored anywhere: it goes to the transcription function
 * as base64, comes back as text, and the local file is deleted.
 */

export const canDictate = Platform.OS !== 'web';

let recording: Audio.Recording | null = null;

export async function startDictation(): Promise<void> {
  const perm = await Audio.requestPermissionsAsync();
  if (!perm.granted) throw new Error('The microphone permission was refused.');

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const rec = new Audio.Recording();
  // The high-quality preset is m4a/AAC on both platforms, which the
  // transcription API accepts directly -- no conversion step.
  await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await rec.startAsync();
  recording = rec;
}

/** Stop, transcribe, and clean up. Returns the text. */
export async function stopDictation(): Promise<string> {
  if (!recording) throw new Error('nothing is recording');
  const rec = recording;
  recording = null;

  await rec.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  const uri = rec.getURI();
  if (!uri) throw new Error('the recording produced no file');

  try {
    const audio = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (audio.length < 1000) throw new Error('That was too short to hear.');

    const { data, error } = await supabase.functions.invoke('transcribe', {
      body: { audio, mime: 'audio/m4a' },
    });
    if (error) {
      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(detail?.error ?? error.message);
    }
    const text = (data as { text?: string })?.text?.trim() ?? '';
    if (!text) throw new Error('Nothing was heard in that.');
    return text;
  } finally {
    // Delete it either way. There is no reason for a recording of a private
    // conversation to sit on the phone after it has been read.
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}

/** Abandon a recording without transcribing it. */
export async function cancelDictation(): Promise<void> {
  const rec = recording;
  recording = null;
  if (!rec) return;
  try {
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI();
    if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  } catch {
    // Already stopped, or never started. Nothing to do.
  }
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
}
