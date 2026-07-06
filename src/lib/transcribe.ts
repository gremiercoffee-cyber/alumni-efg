import { supabase } from './supabase';

export async function transcribeAudio(audioUri: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as any);

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/transcribe`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Transcription failed: ${await response.text()}`);
  }

  const data = await response.json();
  return String(data.transcript || '').trim();
}
