import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async req => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const formData = await req.formData();
  const audioFile = formData.get('file') as File | null;

  if (!audioFile) return new Response('No audio file provided', { status: 400 });

  const openaiForm = new FormData();
  openaiForm.append('file', audioFile, 'recording.m4a');
  openaiForm.append('model', 'gpt-4o-mini-transcribe');
  openaiForm.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: openaiForm,
  });

  if (!response.ok) {
    const err = await response.text();
    return new Response(`OpenAI error: ${err}`, { status: 500 });
  }

  const transcript = await response.text();
  return new Response(JSON.stringify({ transcript }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
