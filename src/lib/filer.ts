import { supabase } from './supabase';

/**
 * The filer: type a note, see what it understood, confirm, file.
 *
 * Nothing is written until confirmed. The Edge Function only reads and
 * proposes; everything here writes through the normal tables, so a
 * misunderstanding can put a wrong row on screen but never into the database.
 */

export type Candidate = { id: number; name: string; do_not_contact: boolean };

export type Proposal = {
  action: string;
  person_said: string;
  date_text?: string;
  date_iso?: string;
  event?: string;
  field?: string;
  value?: string;
  spouse?: string;
  nights?: number;
  guests?: number;
  note?: string;
  match: Candidate | null;
  candidates: Candidate[];
};

export type FilerResult = {
  transcript: string;
  unclear: string | null;
  proposals: Proposal[];
  model: string;
};

/** How each action reads back, for the confirmation list. */
export const ACTION_LABEL: Record<string, string> = {
  visit_came: 'came to yeshiva',
  visit_stayed: 'stayed in yeshiva',
  visit_expected: 'is coming to yeshiva',
  event_attending: 'is coming to',
  engagement: 'got engaged',
  wedding_scheduled: 'wedding date set',
  wedding: 'getting married',
  birth: 'had a baby',
  bar_mitzvah: 'made a bar mitzvah',
  update_field: 'update',
};

export async function readNote(transcript: string): Promise<FilerResult> {
  const { data, error } = await supabase.functions.invoke('ai-filer', {
    body: { transcript },
  });
  if (error) {
    // The function's own message is far more useful than "non-2xx status".
    const detail = await (error as { context?: Response }).context
      ?.json?.()
      .catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data as FilerResult;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Write one confirmed proposal.
 *
 * Deliberately writes through the same tables the screens use, rather than a
 * privileged path of its own -- if RLS would refuse a person doing this by
 * hand, it refuses the filer too.
 */
export async function fileOne(p: Proposal, personId: number): Promise<void> {
  const on = p.date_iso && /^\d{4}-\d{2}-\d{2}$/.test(p.date_iso) ? p.date_iso : today();
  const { data: me } = await supabase.auth.getUser();
  const uid = me.user?.id ?? null;

  switch (p.action) {
    case 'visit_came':
    case 'visit_stayed':
    case 'visit_expected': {
      const { error } = await supabase.from('visits').insert({
        person_id: personId,
        visited_on: on,
        overnight: p.action === 'visit_stayed',
        nights: p.nights ?? null,
        // "Coming" and "came" are different facts; only the second is evidence.
        expected: p.action === 'visit_expected',
        note: p.note ?? null,
        recorded_by: uid,
      });
      if (error) throw error;
      return;
    }

    case 'event_attending': {
      // Match the event by name, else the nearest upcoming one -- "coming to
      // the shabbaton" usually means the next shabbaton.
      const { data: events } = await supabase
        .from('events')
        .select('id, name, starts_on')
        .order('starts_on', { ascending: true });
      const wanted = (p.event ?? '').toLowerCase();
      const hit =
        (wanted && events?.find((e) => e.name.toLowerCase().includes(wanted))) ||
        events?.find((e) => (e.starts_on ?? '') >= today()) ||
        events?.[0];
      if (!hit) throw new Error('there is no event to add him to yet');
      const { error } = await supabase.from('event_attendance').insert({
        event_id: hit.id,
        person_id: personId,
        guests: p.guests ?? 0,
        source: 'admin',
      });
      if (error) throw error;
      return;
    }

    case 'update_field': {
      if (!p.field) throw new Error('no field to update');
      // A computed key defeats the generated row type. The set of allowed
      // fields is enforced by the database function and the Edge Function's
      // schema, not here, so this cast asserts nothing the server does not
      // already check.
      const patch = { [p.field]: p.value ?? null } as Record<string, string | null>;
      const { error } = await supabase
        .from('people')
        .update(patch as never)
        .eq('id', personId);
      if (error) throw error;
      return;
    }

    default: {
      // The simchas: engagement, wedding_scheduled, wedding, birth, bar_mitzvah.
      const { error } = await supabase.from('simchas').insert({
        person_id: personId,
        type: p.action as never,
        // An engagement is dated the day it is heard about. It has no date of
        // its own -- nobody records the hour a couple agreed -- but a row with
        // no date at all never appears on the feed, because the feed asks for
        // the last two years and a null is not in any range. The imported ones
        // are invisible for exactly this reason.
        occurred_on: on,
        wedding_on: p.action === 'wedding_scheduled' ? on : null,
        spouse_name: p.spouse ?? null,
        note: p.note ?? null,
        created_by: uid,
      });
      if (error) throw error;
    }
  }
}

/** A one-line summary of a proposal, for the confirmation list. */
export function describe(p: Proposal): string {
  if (p.action === 'update_field') {
    return `${p.field?.replace(/_/g, ' ')} → ${p.value}`;
  }
  const label = ACTION_LABEL[p.action] ?? p.action;
  const bits = [label];
  if (p.action === 'event_attending' && p.event) bits.push(p.event);
  if (p.spouse) bits.push(`to ${p.spouse}`);
  if (p.nights) bits.push(`${p.nights} nights`);
  if (p.date_text) bits.push(`· ${p.date_text}`);
  return bits.join(' ');
}
