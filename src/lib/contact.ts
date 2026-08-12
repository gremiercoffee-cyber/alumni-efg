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
/** Does this look like a phone number at all, or is it something else? */
export function isDialable(raw: string | null): boolean {
  if (!raw) return false;
  if (/[A-Za-z]{3,}/.test(raw)) return false;          // '169 Baker Avenue'
  return raw.replace(/\D/g, '').length >= 7;
}

export function whatsappNumber(raw: string | null, country: string | null): string | null {
  if (!isDialable(raw)) return null;
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
  // The web needs its own path. react-native-web routes Linking.openURL through
  // window.open, which a popup blocker will refuse for anything not obviously
  // driven by a click -- and it refuses silently, so the button simply does
  // nothing. Navigating the current tab is never blocked, which is what mailto:
  // and tel: want anyway; only wa.me is worth a new tab, and there we fall back
  // to navigating if the popup is refused.
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false;
    try {
      if (url.startsWith('http')) {
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (!w) window.location.assign(url);
      } else {
        window.location.assign(url);
      }
      return true;
    } catch {
      return false;
    }
  }

  // Deliberately no canOpenURL check.
  //
  // Since Android 11, an app can only see other apps it has declared in a
  // <queries> block, and Expo's generated manifest declares none -- so
  // canOpenURL answered false for wa.me, tel: and mailto: alike and every
  // button did nothing. On the web there is no such restriction, which is why
  // the links worked there and not in the APK.
  //
  // Just try it. A failure throws, which is a truthful signal; a false negative
  // from canOpenURL is not.
  try {
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

  if (!isDialable(p.phone)) {
    Alert.alert(
      'Not a phone number',
      `His phone field reads "${p.phone}". That is not something this can dial -- ` +
        'it looks like it belongs in another field.',
    );
    return;
  }

  const wa = whatsappNumber(p.phone, p.country);
  const opened = wa ? await open(`https://wa.me/${wa}`) : false;

  if (opened) {
    void logInteraction(p.id, 'whatsapp');
  } else {
    const dialled = await open(`tel:${p.phone.split('/')[0].replace(/\s/g, '')}`);
    if (!dialled) {
      Alert.alert(
        'Could not open',
        wa
          ? `WhatsApp did not open for ${p.phone}.`
          : `${p.phone} is not a number this can dial. Copy it by hand.`,
      );
      return;
    }
    void logInteraction(p.id, 'call');
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
  void logInteraction(p.id, 'email');
  onLogged?.();
}

/** A wa.me link with text but no recipient: opens WhatsApp to pick who to send to. */
export function announcementLink(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
