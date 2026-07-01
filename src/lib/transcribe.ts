import * as FileSystem from 'expo-file-system';

export async function transcribeAudio(
  audioUri: string,
  openaiKey: string
): Promise<string> {
  // Read the audio file as base64
  const base64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Convert base64 to a blob-like FormData entry
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as any);
  formData.append('model', 'gpt-4o-mini-transcribe');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Transcription failed: ${err}`);
  }

  const text = await response.text();
  return text.trim();
}
