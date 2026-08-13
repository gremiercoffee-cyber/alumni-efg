import { createClient } from 'jsr:@supabase/supabase-js@2';
import { FILE_TOOL, SYSTEM_PROMPT } from './vocabulary.ts';
import { resolvePerson, type Candidate } from './resolve.ts';

/**
 * Turn a spoken note into filing actions, for the admin to confirm.
 *
 * This function NEVER writes anything. It reads the note, works out what is
 * being filed and against whom, and hands back a proposal. The writing happens
 * only after the admin confirms, through the normal tables and their normal
 * policies -- so an AI misunderstanding can put a wrong thing on screen, but
 * never into the database.
 */

// The full id, not the `gpt-5.6` alias -- that alias routes to Sol, not Luna.
const MODEL = Deno.env.get('AI_FILER_MODEL') ?? 'gpt-5.6-luna';
// Luna takes a reasoning effort. Left unset by default so the call cannot fail
// on an unsupported parameter; set AI_FILER_EFFORT=low to make it cheaper and
// faster, which is what extraction wants.
const EFFORT = Deno.env.get('AI_FILER_EFFORT');
const API_KEY = Deno.env.get('OPENAI_API_KEY');
const API_URL = Deno.env.get('AI_FILER_URL') ?? 'https://api.openai.com/v1/chat/completions';

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

  // The caller's own token, so their RLS applies. The filer is admin-only, and
  // this is what enforces it -- not the client hiding a button.
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

  const { transcript } = await req.json().catch(() => ({ transcript: '' }));
  if (!transcript || typeof transcript !== 'string') {
    return json({ error: 'nothing to file' }, 400);
  }

  // The roster goes in every call, as asked. It is the biggest cost here --
  // roughly 6k tokens -- but the filer runs a handful of times a day, and a
  // model that can see the names guesses less.
  const { data: people } = await supabase
    .from('people')
    .select('id, first_name, last_name, nickname, do_not_contact');
  const { data: aliases } = await supabase.from('person_aliases').select('person_id, alias');

  const aliasFor = new Map<number, string[]>();
  for (const a of aliases ?? []) {
    aliasFor.set(a.person_id, [...(aliasFor.get(a.person_id) ?? []), a.alias]);
  }
  const roster = (people ?? [])
    .map((p) => {
      const also = aliasFor.get(p.id) ?? [];
      return `${p.first_name} ${p.last_name}${also.length ? ` (also: ${also.join('; ')})` : ''}`;
    })
    .sort()
    .join('\n');

  // --- ask the model what is being filed ---------------------------------
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            `${SYSTEM_PROMPT}\n\nToday is ${today}.\n\n` +
            'Every alumnus, one per line. Names in brackets are other spellings ' +
            `of the same man:\n${roster}`,
        },
        { role: 'user', content: transcript },
      ],
      tools: [FILE_TOOL],
      tool_choice: { type: 'function', function: { name: 'file_actions' } },
      // No temperature: reasoning models reject it, and this is extraction --
      // there is nothing here to be creative about.
      ...(EFFORT ? { reasoning_effort: EFFORT } : {}),
    }),
  });

  if (!res.ok) {
    return json({ error: `model call failed: ${res.status} ${await res.text()}` }, 502);
  }

  const body = await res.json();
  const call = body.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return json({ error: 'the model returned nothing to file' }, 502);

  let parsed: { actions?: unknown[]; unclear?: string };
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    return json({ error: 'could not read the model response' }, 502);
  }

  // --- resolve each name against the database ----------------------------
  //
  // Done here, not by the model. The matcher knows Yaakov is Jacob and that
  // there are two Avi Greens; a model handed a list of names knows neither.
  const proposals = [];
  for (const raw of (parsed.actions ?? []) as Record<string, unknown>[]) {
    const said = String(raw.person_said ?? '');
    const matches: Candidate[] = resolvePerson(said, people ?? [], aliases ?? []);
    proposals.push({
      ...raw,
      person_said: said,
      // One confident match, several to choose between, or none.
      match: matches.length === 1 ? matches[0] : null,
      candidates: matches.length === 1 ? [] : matches.slice(0, 5),
    });
  }

  return json({
    transcript,
    unclear: parsed.unclear ?? null,
    proposals,
    model: MODEL,
  });
});
