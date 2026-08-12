import { Alert, Linking, Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Reaching an alumnus, and recording that someone did.
 *
 * Honest about what it records: opening WhatsApp is not the same as sending a
 * message. Everything here logs "reached out", never "made contact", and it must
 * never be read as evidence the alumnus heard anything.
 */

/**
 * wa.me wants digits only, with a country code and no leading zeros.
 *
 * The source numbers are a mess -- '1-845-659-2040', '447855240767',
 * '(224) 623-2099', '055-338-4276/516-776-5' -- so this normalises rather than
 * trusting them. Returns null when it cannot be confident, and the caller falls
 * back to a plain dial.
 */
export function whatsappNumber(raw: string | null, country: string | null): string | null {
  if (!raw) return null;

  // A few records hold two numbers separated by a slash. Take the first.
  const first = raw.split('/')[0];
  let digits = first.replace(/\D/g, '');
  if (digits.length < 7) return null;

  // Already has a plausible country code.
  if (first.trim().startsWith('+')) return digits;

  const cc = { USA: '1', CA: '1', Canada: '1', UK: '44', Israel: '972' }[country ?? ''] ?? null;

  if (digits.length === 10 && (cc === '1' || !cc)) return '1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits;

  // Local form with a trunk zero, e.g. UK '07938…' or Israel '055-338-4276'.
  if (cc && digits.startsWith('0')) return cc + digits.slice(1);
  if (cc && digits.length <= 10) return cc + digits;

  // Long enough to already carry a country code.
  return digits.length >= 11 ? digits : null;
}

export type ReachChannel = 'whatsapp' | 'call' | 'email';

/**
 * Record that someone reached out. Deliberately fire-and-forget: a failure to
 * log must never stop the call or the message going out.
 */
async function logInteraction(personId: number, channel: ReachChannel) {
  const { data } = await supabase.auth.getUser();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from('interactions').insert({
    person_id: personId,
    occurred_on: today,
    channel,
    source: 'app_tap',
    recorded_by: data.user?.id ?? null,
  });
  if (error) console.warn('could not log interaction', error.message);
}

async function open(url: string): Promise<boolean> {
  try {
    // canOpenURL is unreliable on web and for custom schemes, so on web we just
    // try it; on native a false answer means the app genuinely is not installed.
    if (Platform.OS !== 'web' && !(await Linking.canOpenURL(url))) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

type Reachable = {
  id: number;
  phone: string | null;
  email: string | null;
  country: string | null;
  do_not_contact: boolean;
};

function blocked(p: Reachable): boolean {
  if (!p.do_not_contact) return false;
  Alert.alert(
    'Do not contact',
    'This man asked not to be contacted. Nothing has been sent.',
  );
  return true;
}

/** WhatsApp if we can build a usable number, otherwise a plain dial. */
export async function reachByPhone(p: Reachable, onLogged?: () => void) {
  if (blocked(p)) return;
  if (!p.phone) return;

  const wa = whatsappNumber(p.phone, p.country);
  const opened = wa ? await open(`https://wa.me/${wa}`) : false;

  if (opened) {
    await logInteraction(p.id, 'whatsapp');
  } else {
    const dialled = await open(`tel:${p.phone.split('/')[0].replace(/\s/g, '')}`);
    if (!dialled) {
      Alert.alert('Could not open', p.phone);
      return;
    }
    await logInteraction(p.id, 'call');
  }
  onLogged?.();
}

export async function reachByEmail(p: Reachable, onLogged?: () => void) {
  if (blocked(p)) return;
  if (!p.email) return;
  if (!(await open(`mailto:${p.email}`))) {
    Alert.alert('Could not open', p.email);
    return;
  }
  await logInteraction(p.id, 'email');
  onLogged?.();
}

/** A wa.me link with text but no recipient: opens WhatsApp to pick who to send to. */
export function announcementLink(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
