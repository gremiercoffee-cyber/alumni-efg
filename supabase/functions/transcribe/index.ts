import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Turn a recording into text.
 *
 * Separate from ai-filer on purpose: transcription is the one slow, expensive
 * step, and keeping it apart means a misheard word can be corrected in the box
 * before anything is parsed -- rather than re-recording the whole note.
 *
 * The audio is never stored. It arrives, goes to the transcription API, and the
 * text comes back; nothing is written to disk or to a bucket.
 */

const MODEL = Deno.env.get('TRANSCRIBE_MODEL') ?? 'gpt-4o-mini-transcribe';
const API_KEY = Deno.env.get('OPENAI_API_KEY');
const API_URL = Deno.env.get('TRANSCRIBE_URL')
  ?? 'https://api.openai.com/v1/audio/transcriptions';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!API_KEY) return json({ error: 'OPENAI_API_KEY is not set on the function' }, 500);

  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: 'not signed in' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') return json({ error: 'admin only' }, 403);

  const { audio, mime } = await req.json().catch(() => ({}));
  if (typeof audio !== 'string' || !audio) return json({ error: 'no audio' }, 400);

  // Base64 in, bytes out. Chunked because a long note is a few MB and
  // atob-then-map over the whole thing at once blows the stack.
  let bytes: Uint8Array;
  try {
    const binary = atob(audio);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    return json({ error: 'the audio could not be decoded' }, 400);
  }

  const type = typeof mime === 'string' && mime ? mime : 'audio/m4a';
  const ext = type.includes('mp4') || type.includes('m4a') ? 'm4a'
    : type.includes('webm') ? 'webm'
    : type.includes('wav') ? 'wav'
    : 'm4a';

  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), `note.${ext}`);
  form.append('model', MODEL);
  // Names the model would otherwise mangle. Not the whole roster -- a prompt is
  // a hint, not a lookup, and the filer resolves names properly afterwards.
  form.append(
    'prompt',
    'A note about yeshiva alumni. Names may be Hebrew or English: Yaakov, Shmuel, '
      + 'Yehoshua, Avi, Moshe, Chaim, Shabbos, shabbaton, yeshiva, Mazal tov.',
  );

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    return json({ error: `transcription failed: ${res.status} ${await res.text()}` }, 502);
  }

  const body = await res.json();
  return json({ text: body.text ?? '', model: MODEL });
});
