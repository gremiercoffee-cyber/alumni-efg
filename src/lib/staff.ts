import { Alert } from 'react-native';
import { supabase } from './supabase';

/**
 * "Let staff know" -- an on-demand note to the whole rebbeim list.
 *
 * The admin presses it next to a change or an event he wants the staff to hear
 * about: "he moved to Israel", "give him a call". It is queued as a broadcast
 * and the sender emails the list. Deliberately not automatic -- a person is
 * choosing to send this, which is exactly why it is a button and not a rule.
 *
 * Confirms first, showing the exact message, because it reaches everyone.
 */
export function letStaffKnow(subject: string, body: string, personId?: number | null) {
  Alert.alert(
    'Let staff know?',
    `${subject}\n\n${body}\n\nThis emails the whole rebbeim list.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send to staff',
        onPress: async () => {
          const { data: me } = await supabase.auth.getUser();
          const { error } = await supabase.from('staff_broadcasts').insert({
            subject,
            body,
            person_id: personId ?? null,
            created_by: me.user?.id ?? null,
          });
          if (error) {
            Alert.alert('Could not send', error.message);
            return;
          }
          Alert.alert('Sent to staff', 'The rebbeim list will get it shortly.');
        },
      },
    ],
  );
}
