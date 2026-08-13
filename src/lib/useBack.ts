import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Going back, by whichever means the platform offers.
 *
 *   Android   the hardware/gesture back button
 *   web       the browser's back button, and the Backspace key
 *
 * Backspace is bound only when the focus is not in a text field -- otherwise it
 * would eat a character and navigate away mid-sentence, which is exactly the
 * behaviour browsers dropped it for years ago. It is bound here because it was
 * asked for, and because on a laptop it is the fastest key to reach.
 *
 * `goBack` returns true if it handled the press. Returning false on Android
 * lets the OS take it, which closes the app -- correct when there is nowhere
 * left to go back to.
 */
export function useBack(goBack: () => boolean) {
  useEffect(() => {
    if (Platform.OS === 'android') {
      const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
      return () => sub.remove();
    }

    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // The browser's back button. A history entry is pushed whenever the app
    // goes deeper, so there is something to pop; without that, back would leave
    // the site entirely from the first screen.
    const onPop = () => {
      if (goBack()) {
        // Handled internally, so put an entry back for the next press.
        window.history.pushState({ app: true }, '');
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace') return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || el?.isContentEditable) return;
      if (goBack()) e.preventDefault();
    };

    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
    };
  }, [goBack]);
}

/** Push a history entry so the browser's back button has something to pop. */
export function markNavigation() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.pushState({ app: true }, '');
  }
}
